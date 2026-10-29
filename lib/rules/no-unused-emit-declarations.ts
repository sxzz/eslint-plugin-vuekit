/**
 * @author ItMaga
 * See LICENSE file in root directory for full license.
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule
} from '../types/rule.ts'

import type {
  CallExpression,
  Expression,
  Identifier,
  RuleContext,
  SpreadElement,
  Super
} from '../types/index.ts'

import { findVariable } from '@eslint-community/eslint-utils'
import {
  getNameParamNode,
  skipChainExpression,
  getStaticPropertyName,
  isThis,
  compositingVisitors,
  defineTemplateBodyVisitor,
  defineVueVisitor,
  getComponentEmitsFromOptions,
  findAssignmentProperty,
  getScope,
  defineScriptSetupVisitor
} from '../utils/index.ts'

export type ComponentEmit = import('../utils').ComponentEmit
export type NameWithLoc = import('../utils').NameWithLoc
export type VueObjectData = import('../utils').VueObjectData

export type SetupContext = {
  contextReferenceIds: Set<Identifier>
  emitReferenceIds: Set<Identifier>
}

/**
 * Check if the given node is a reference of setup context
 */
function hasReferenceId(
  value: Expression | Super | SpreadElement,
  setupContext: SetupContext
) {
  const { contextReferenceIds, emitReferenceIds } = setupContext
  return (
    value.type === 'Identifier' &&
    (emitReferenceIds.has(value) || contextReferenceIds.has(value))
  )
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow unused emit declarations',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-unused-emit-declarations.html'
    },
    schema: [],
    messages: {
      unused: '`{{name}}` is defined as emit but never used.'
    }
  },

  create(context: RuleContext) {
    const emitDeclarations = new Map()

    const emitCalls = new Map()

    const setupContexts = new Map()
    const programNode = context.sourceCode.ast
    let emitParamName = ''

    function addEmitCall(node: CallExpression) {
      const nameParamNode = getNameParamNode(node)
      if (nameParamNode) {
        emitCalls.set(nameParamNode.name, node)
      }
    }
    function clearEmits() {
      emitCalls.clear()
      emitDeclarations.clear()
    }

    function checkExpressionReference(
      expression: Expression | SpreadElement,
      setupContext: SetupContext
    ) {
      if (expression.type === 'MemberExpression') {
        const memObject = skipChainExpression(expression.object)
        if (hasReferenceId(memObject, setupContext)) {
          clearEmits()
          return true
        }
      }
      if (hasReferenceId(expression, setupContext)) {
        clearEmits()
        return true
      }
      return false
    }

    function verifyArgumentsReferences(
      args: Array<Expression | SpreadElement>,
      setupContext: SetupContext
    ) {
      for (const argument of args) {
        if (argument.type === 'ObjectExpression') {
          for (const property of argument.properties) {
            if (
              property.type === 'Property' &&
              checkExpressionReference(property.value, setupContext)
            ) {
              return true
            }
          }
        } else if (
          argument.type === 'ArrayExpression' &&
          argument.elements.some(
            (element: any) =>
              element && checkExpressionReference(element, setupContext)
          )
        ) {
          return true
        }

        if (checkExpressionReference(argument, setupContext)) {
          return true
        }
      }
      return false
    }

    function addEmitCallByReference(
      callee: Expression | Super,
      referenceIds: Set<Identifier>,
      node: CallExpression
    ) {
      if (callee.type === 'Identifier' && referenceIds.has(callee)) {
        addEmitCall(node)
      }
    }

    const callVisitor = {
      CallExpression(node: CallExpression, info?: VueObjectData) {
        const callee = skipChainExpression(node.callee)

        let emit = null
        if (callee.type === 'MemberExpression') {
          const name = getStaticPropertyName(callee)
          if (name === 'emit' || name === '$emit') {
            emit = { name, member: callee }
          }
        }

        const vueDefineNode = info ? info.node : programNode
        const setupContext = setupContexts.get(vueDefineNode)
        if (setupContext) {
          if (
            callee.parent.type === 'CallExpression' &&
            callee.parent.arguments &&
            verifyArgumentsReferences(callee.parent.arguments, setupContext)
          ) {
            // skip if the emit passed as argument
            return
          }

          const { contextReferenceIds, emitReferenceIds } = setupContext

          // verify setup(props,{emit}) {emit()}
          addEmitCallByReference(callee, emitReferenceIds, node)
          if (emit && emit.name === 'emit') {
            const memObject = skipChainExpression(emit.member.object)
            // verify setup(props,context) {context.emit()}
            addEmitCallByReference(memObject, contextReferenceIds, node)
          }
        }

        if (emit && emit.name === '$emit') {
          const memObject = skipChainExpression(emit.member.object)
          // verify this.$emit()
          if (isThis(memObject, context)) {
            addEmitCall(node)
          }
        }

        // verify $emit() and defineEmits variable in template
        if (
          callee.type === 'Identifier' &&
          (callee.name === '$emit' || callee.name === emitParamName)
        ) {
          addEmitCall(node)
        }
      }
    }

    return compositingVisitors(
      defineTemplateBodyVisitor(context, callVisitor),
      defineVueVisitor(context, {
        ...callVisitor,
        onVueObjectEnter(node: any) {
          for (const emit of getComponentEmitsFromOptions(node)) {
            if (emit.emitName) {
              emitDeclarations.set(emit.emitName, emit)
            }
          }
        },
        onSetupFunctionEnter(node: any, { node: vueNode }: any) {
          const contextParam = node.params[1]
          if (
            !contextParam ||
            contextParam.type === 'RestElement' ||
            contextParam.type === 'ArrayPattern'
          ) {
            // no arguments or cannot check
            return
          }

          const contextReferenceIds = new Set()

          const emitReferenceIds = new Set()
          if (contextParam.type === 'ObjectPattern') {
            const emitProperty = findAssignmentProperty(contextParam, 'emit')
            if (!emitProperty) {
              return
            }
            const emitParam = emitProperty.value
            // `setup(props, {emit})`
            const variable =
              emitParam.type === 'Identifier'
                ? (findVariable as unknown as WithVue<typeof findVariable>)(
                    getScope(context, emitParam),
                    emitParam
                  )
                : null
            if (!variable) {
              return
            }
            for (const reference of variable.references) {
              if (reference.identifier.type !== 'Identifier') continue
              emitReferenceIds.add(reference.identifier)
            }
          } else if (contextParam.type === 'Identifier') {
            // `setup(props, context)`
            const variable = (
              findVariable as unknown as WithVue<typeof findVariable>
            )(getScope(context, contextParam), contextParam)
            if (!variable) return
            for (const reference of variable.references) {
              if (reference.identifier.type !== 'Identifier') continue
              contextReferenceIds.add(reference.identifier)
            }
          }

          setupContexts.set(vueNode, {
            contextReferenceIds,
            emitReferenceIds
          })
        }
      }),
      defineScriptSetupVisitor(context, {
        onDefineEmitsEnter(node: any, emits: any) {
          for (const emit of emits) {
            if (emit.emitName) {
              emitDeclarations.set(emit.emitName, emit)
            }
          }

          if (
            !node.parent ||
            node.parent.type !== 'VariableDeclarator' ||
            node.parent.init !== node
          ) {
            return
          }

          const emitParam = node.parent.id
          if (emitParam.type !== 'Identifier') {
            return
          }

          emitParamName = emitParam.name
          const variable = (
            findVariable as unknown as WithVue<typeof findVariable>
          )(getScope(context, emitParam), emitParam)
          if (!variable) {
            return
          }

          const emitReferenceIds = new Set()
          for (const reference of variable.references) {
            if (reference.identifier.type !== 'Identifier') continue
            emitReferenceIds.add(reference.identifier)
          }
          setupContexts.set(programNode, {
            contextReferenceIds: new Set(),
            emitReferenceIds
          })
        },
        onDefineModelEnter(node: any, model: any) {
          if (
            node.parent &&
            node.parent.type === 'VariableDeclarator' &&
            node.parent.init === node
          ) {
            // If the return value of defineModel() is stored in a variable, we can mark the 'update:modelName' event as used if that that variable is used.
            // If that variable is unused, it will already be reported by `no-unused-var` rule.
            emitCalls.set(`update:${model.name.modelName}`, node)
          }
        },
        ...callVisitor
      }),
      {
        'Program:exit'() {
          for (const [name, emit] of emitDeclarations) {
            if (!emitCalls.has(name) && emit.node) {
              context.report({
                node: emit.node,
                loc: emit.node.loc,
                messageId: 'unused',
                data: { name }
              })
            }
          }
        }
      }
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
