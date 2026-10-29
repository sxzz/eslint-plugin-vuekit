/**
 * @fileoverview Don't introduce side effects in computed properties
 * @author Michał Sajnóg
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule
} from '../types/rule.ts'

import type {
  ArrowFunctionExpression,
  BlockStatement,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  MemberExpression,
  Program,
  RuleContext,
  ThisExpression
} from '../types/index.ts'

import { ReferenceTracker, findVariable } from '@eslint-community/eslint-utils'
import {
  isThis as utilsIsThis,
  findMutating,
  getScope,
  getScriptSetupElement,
  compositingVisitors,
  iterateReferencesTraceMap,
  getGetterBodyFromComputedFunction,
  defineScriptSetupVisitor,
  defineVueVisitor,
  getComputedProperties,
  isInRange
} from '../utils/index.ts'

export type VueObjectData = import('../utils').VueObjectData
export type VueVisitor = import('../utils').VueVisitor
export type ComponentComputedProperty =
  import('../utils').ComponentComputedProperty

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow side effects in computed properties',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-side-effects-in-computed-properties.html'
    },
    schema: [],
    messages: {
      unexpectedSideEffectInFunction:
        'Unexpected side effect in computed function.',
      unexpectedSideEffectInProperty:
        'Unexpected side effect in "{{key}}" computed property.'
    }
  },

  create(context: RuleContext) {
    const computedPropertiesMap = new Map()

    const computedCallNodes: Array<
      FunctionExpression | ArrowFunctionExpression
    > = []
    type ScopeStack = {
      upper: ScopeStack | null
      body: BlockStatement | Expression | null
    }

    const setupRanges: [number, number][] = []

    let scopeStack: ScopeStack | null = null

    function onFunctionEnter(
      node: FunctionExpression | ArrowFunctionExpression | FunctionDeclaration
    ) {
      scopeStack = {
        upper: scopeStack,
        body: node.body
      }
    }

    function onFunctionExit() {
      scopeStack &&= scopeStack.upper
    }

    const nodeVisitor: any = {
      ':function': onFunctionEnter,
      ':function:exit': onFunctionExit,

      'MemberExpression > :matches(Identifier, ThisExpression)'(
        node: (Identifier | ThisExpression) & { parent: MemberExpression },
        info?: VueObjectData | undefined
      ) {
        if (!scopeStack) {
          return
        }
        const targetBody = scopeStack.body

        const computedProperty = (
          info ? computedPropertiesMap.get(info.node) || [] : []
        ).find(
          (cp: any) =>
            cp.value && isInRange(cp.value, node) && targetBody === cp.value
        )
        if (computedProperty) {
          const mem = node.parent
          if (mem.object !== node) {
            return
          }

          const isThis = utilsIsThis(node, context)
          const isVue = node.type === 'Identifier' && node.name === 'Vue'

          const isVueSet =
            mem.parent.type === 'CallExpression' &&
            mem.property.type === 'Identifier' &&
            ((isThis && mem.property.name === '$set') ||
              (isVue && mem.property.name === 'set'))

          const invalid = isVueSet
            ? { node: mem.property }
            : isThis && findMutating(mem)

          if (invalid) {
            context.report({
              node: invalid.node,
              messageId: 'unexpectedSideEffectInProperty',
              data: { key: computedProperty.key || 'Unknown' }
            })
          }
          return
        }

        // ignore `this` for computed functions
        if (node.type === 'ThisExpression') {
          return
        }

        const computedFunction: any = computedCallNodes.find(
          (c) => isInRange(c, node) && targetBody === c.body
        )
        if (!computedFunction) {
          return
        }

        const mem = node.parent
        if (mem.object !== node) {
          return
        }

        const variable = (
          findVariable as unknown as WithVue<typeof findVariable>
        )(getScope(context, node), node)
        if (!variable || variable.defs.length !== 1) {
          return
        }

        const def = variable.defs[0]
        if (
          ['ImplicitGlobalVariable', 'TDZ', 'ImportBinding'].includes(def.type)
        ) {
          return
        }

        const isDeclaredInsideSetup: any = setupRanges.some(([start, end]) =>
          isInRange([start, end], def.node)
        )
        if (
          !isDeclaredInsideSetup ||
          // mutating local variables are accepted
          isInRange(computedFunction, def.node)
        ) {
          return
        }

        const invalid = findMutating(node)
        if (invalid) {
          context.report({
            node: invalid.node,
            messageId: 'unexpectedSideEffectInFunction'
          })
        }
      }
    }
    const scriptSetupNode = getScriptSetupElement(context)
    if (scriptSetupNode) {
      setupRanges.push(scriptSetupNode.range)
    }
    return compositingVisitors(
      {
        Program(program: Program) {
          const tracker = new ReferenceTracker(
            getScope(context, program) as unknown as ConstructorParameters<
              typeof ReferenceTracker
            >[0]
          )

          const computedRefs = iterateReferencesTraceMap(tracker, {
            computed: {
              [ReferenceTracker.CALL]: true
            }
          })
          for (const { node } of computedRefs) {
            if (node.type !== 'CallExpression') {
              continue
            }

            const getterBody = getGetterBodyFromComputedFunction(node)
            if (getterBody) {
              computedCallNodes.push(getterBody)
            }
          }
        }
      },
      scriptSetupNode
        ? defineScriptSetupVisitor(context, nodeVisitor)
        : defineVueVisitor(context, {
            onVueObjectEnter(node: any) {
              computedPropertiesMap.set(node, getComputedProperties(node))
            },
            onSetupFunctionEnter(node: any) {
              setupRanges.push(node.body.range)
            },
            ...nodeVisitor
          })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
