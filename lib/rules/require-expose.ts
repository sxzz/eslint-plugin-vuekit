/**
 * @fileoverview Require `expose` in Vue components
 * @author Yosuke Ota <https://github.com/ota-meshi>
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule
} from '../types/rule.ts'

import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  ObjectExpression,
  Property,
  RuleContext,
  RuleFixer,
  SpreadElement
} from '../types/index.ts'

import {
  findVariable,
  isOpeningBraceToken,
  isClosingBraceToken
} from '@eslint-community/eslint-utils'
import {
  getStaticPropertyName,
  skipChainExpression,
  isScriptSetup,
  getScope,
  defineVueVisitor,
  findAssignmentProperty,
  isProperty,
  iterateProperties,
  getVueComponentDefinitionType
} from '../utils/index.ts'

const FIX_EXPOSE_BEFORE_OPTIONS = new Set([
  'name',
  'components',
  'directives',
  'extends',
  'mixins',
  'provide',
  'inject',
  'inheritAttrs',
  'props',
  'emits'
])

function isExposeProperty(node: Property | SpreadElement) {
  return (
    node.type === 'Property' &&
    getStaticPropertyName(node) === 'expose' &&
    !node.computed
  )
}

/**
 * Get the callee member node from the given CallExpression
 */
function getCalleeMemberNode(node: CallExpression) {
  const callee = skipChainExpression(node.callee)

  if (callee.type === 'MemberExpression') {
    const name = getStaticPropertyName(callee)
    if (name) {
      return { name, member: callee }
    }
  }
  return null
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require declare public properties using `expose`',
      categories: undefined,
      url: 'https://eslint.vuejs.org/rules/require-expose.html'
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      requireExpose:
        'The public properties of the component must be explicitly declared using `expose`. If the component does not have public properties, declare it empty.',
      addExposeOptionForEmpty:
        'Add the `expose` option to give an empty array.',
      addExposeOptionForAll:
        'Add the `expose` option to declare all properties.'
    }
  },

  create(context: RuleContext) {
    if (isScriptSetup(context)) {
      return {}
    }

    const setupContexts = new Map()
    type ScopeStack = {
      upper: ScopeStack | null
      functionNode: FunctionNode
      returnFunction: boolean
    }

    const calledExpose = new Set()

    type FunctionNode =
      FunctionExpression | FunctionDeclaration | ArrowFunctionExpression

    let scopeStack: ScopeStack | null = null

    const setupFunctions = new Map()

    const setupRender = new Set()

    function isFunction(node: Expression) {
      if (
        node.type === 'ArrowFunctionExpression' ||
        node.type === 'FunctionExpression'
      ) {
        return true
      }
      if (node.type === 'Identifier') {
        const variable = (
          findVariable as unknown as WithVue<typeof findVariable>
        )(getScope(context, node), node)
        if (variable) {
          for (const def of variable.defs) {
            if (def.type === 'FunctionName') {
              return true
            }
            if (def.type === 'Variable' && def.node.init) {
              return isFunction(def.node.init)
            }
          }
        }
      }
      return false
    }
    return defineVueVisitor(context, {
      onSetupFunctionEnter(node: any, { node: vueNode }: any) {
        setupFunctions.set(node, vueNode)
        const contextParam = node.params[1]
        if (
          // no arguments
          !contextParam ||
          // cannot check
          contextParam.type === 'RestElement' ||
          contextParam.type === 'ArrayPattern'
        ) {
          return
        }

        const contextReferenceIds = new Set()

        const exposeReferenceIds = new Set()
        if (contextParam.type === 'ObjectPattern') {
          const exposeProperty = findAssignmentProperty(contextParam, 'expose')
          if (!exposeProperty) {
            return
          }
          const exposeParam = exposeProperty.value
          // `setup(props, {emit})`
          const variable =
            exposeParam.type === 'Identifier'
              ? (findVariable as unknown as WithVue<typeof findVariable>)(
                  getScope(context, exposeParam),
                  exposeParam
                )
              : null
          if (!variable) {
            return
          }
          for (const reference of variable.references) {
            if (
              reference.identifier.type !== 'Identifier' ||
              !reference.isRead()
            ) {
              continue
            }
            exposeReferenceIds.add(reference.identifier)
          }
        } else if (contextParam.type === 'Identifier') {
          // `setup(props, context)`
          const variable = (
            findVariable as unknown as WithVue<typeof findVariable>
          )(getScope(context, contextParam), contextParam)
          if (!variable) {
            return
          }
          for (const reference of variable.references) {
            if (
              reference.identifier.type !== 'Identifier' ||
              !reference.isRead()
            ) {
              continue
            }
            contextReferenceIds.add(reference.identifier)
          }
        }
        setupContexts.set(vueNode, {
          contextReferenceIds,
          exposeReferenceIds
        })
      },
      CallExpression(node: any, { node: vueNode }: any) {
        if (calledExpose.has(vueNode)) {
          // already called
          return
        }
        // find setup context
        const setupContext = setupContexts.get(vueNode)
        if (!setupContext) {
          return
        }

        const { contextReferenceIds, exposeReferenceIds } = setupContext
        if (
          node.callee.type === 'Identifier' &&
          exposeReferenceIds.has(node.callee)
        ) {
          // setup(props,{expose}) {expose()}
          calledExpose.add(vueNode)
        } else {
          const expose = getCalleeMemberNode(node)
          if (
            expose?.name === 'expose' &&
            expose.member.object.type === 'Identifier' &&
            contextReferenceIds.has(expose.member.object)
          ) {
            // setup(props,context) {context.emit()}
            calledExpose.add(vueNode)
          }
        }
      },

      ':function'(node: FunctionNode) {
        scopeStack = {
          upper: scopeStack,
          functionNode: node,
          returnFunction: false
        }

        if (
          node.type === 'ArrowFunctionExpression' &&
          node.expression &&
          isFunction(node.body)
        ) {
          scopeStack.returnFunction = true
        }
      },
      ReturnStatement(node: any) {
        if (!scopeStack) {
          return
        }
        if (
          !scopeStack.returnFunction &&
          node.argument &&
          isFunction(node.argument)
        ) {
          scopeStack.returnFunction = true
        }
      },
      ':function:exit'(node: any) {
        if (scopeStack && scopeStack.returnFunction) {
          const vueNode = setupFunctions.get(node)
          if (vueNode) {
            setupRender.add(vueNode)
          }
        }
        scopeStack &&= scopeStack.upper
      },
      onVueObjectExit(component: any, { type }: any) {
        // `expose` function is called or `setup` function is render function
        if (calledExpose.has(component) || setupRender.has(component)) {
          return
        }
        if (type === 'definition') {
          const defType = getVueComponentDefinitionType(context, component)
          if (defType === 'mixin') {
            return
          }
        }

        if (component.properties.some(isExposeProperty)) {
          // has `expose`
          return
        }

        context.report({
          node: component,
          messageId: 'requireExpose',
          suggest: buildSuggest(component, context)
        })
      }
    })
  }
} satisfies RuleDefinition as RuleDefinition as PublicRuleModule

function buildSuggest(object: ObjectExpression, context: RuleContext) {
  const propertyNodes = object.properties.filter(isProperty)

  const sourceCode = context.sourceCode
  const beforeOptionNode = propertyNodes.find((p: any) =>
    FIX_EXPOSE_BEFORE_OPTIONS.has(getStaticPropertyName(p) || '')
  )
  const allProps = [
    ...new Set(
      iterateProperties(
        object,
        new Set(['props', 'data', 'computed', 'setup', 'methods', 'watch'])
      )
    )
  ]
  return [
    {
      messageId: 'addExposeOptionForEmpty',
      fix: buildFix('expose: []')
    },
    ...(allProps.length > 0
      ? [
          {
            messageId: 'addExposeOptionForAll',
            fix: buildFix(
              `expose: [${allProps
                .map((p) => JSON.stringify(p.name))
                .join(', ')}]`
            )
          }
        ]
      : [])
  ]

  function buildFix(text: string) {
    return (fixer: RuleFixer) => {
      if (beforeOptionNode) {
        return fixer.insertTextAfter(beforeOptionNode, `,\n${text}`)
      }
      if (object.properties.length > 0) {
        const after = propertyNodes[0] || object.properties[0]
        return fixer.insertTextAfter(
          sourceCode.getTokenBefore(after),
          `\n${text},`
        )
      }
      const objectLeftBrace = sourceCode.getFirstToken(
        object,
        isOpeningBraceToken as unknown as WithVue<typeof isOpeningBraceToken>
      )
      const objectRightBrace = sourceCode.getLastToken(
        object,
        isClosingBraceToken as unknown as WithVue<typeof isClosingBraceToken>
      )
      if (!objectLeftBrace || !objectRightBrace) return null
      return fixer.insertTextAfter(
        objectLeftBrace,
        `\n${text}${
          objectLeftBrace.loc.end.line < objectRightBrace.loc.start.line
            ? ''
            : '\n'
        }`
      )
    }
  }
}

export default rule as typeof rule & PublicRuleModule
