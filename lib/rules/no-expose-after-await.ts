/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule
} from '../types/rule.ts'

import type {
  ArrowFunctionExpression,
  AwaitExpression,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  Program,
  RuleContext
} from '../types/index.ts'

import { findVariable } from '@eslint-community/eslint-utils'
import {
  skipChainExpression,
  getStaticPropertyName,
  compositingVisitors,
  isInRange,
  getScriptSetupElement,
  defineVueVisitor,
  findAssignmentProperty,
  getScope
} from '../utils/index.ts'

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
    type: 'problem',
    docs: {
      description: 'disallow asynchronously registered `expose`',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-expose-after-await.html'
    },
    schema: [],
    messages: {
      forbidden: '`{{name}}` is forbidden after an `await` expression.'
    }
  },

  create(context: RuleContext) {
    const setupScopes = new Map()

    type ScopeStack = {
      upper: ScopeStack | null
      scopeNode:
        | FunctionDeclaration
        | FunctionExpression
        | ArrowFunctionExpression
        | Program
    }

    let scopeStack: ScopeStack | null = null

    return compositingVisitors(
      {
        Program(node: Program) {
          scopeStack = {
            upper: scopeStack,
            scopeNode: node
          }
        }
      },
      {
        ':function'(
          node:
            FunctionExpression | FunctionDeclaration | ArrowFunctionExpression
        ) {
          scopeStack = {
            upper: scopeStack,
            scopeNode: node
          }
        },
        ':function:exit'() {
          scopeStack &&= scopeStack.upper
        },

        AwaitExpression(node: AwaitExpression) {
          if (!scopeStack) {
            return
          }
          const setupScope = setupScopes.get(scopeStack.scopeNode)
          if (!setupScope || !isInRange(setupScope.range, node)) {
            return
          }
          setupScope.afterAwait = true
        },

        CallExpression(node: CallExpression) {
          if (!scopeStack) {
            return
          }
          const setupScope = setupScopes.get(scopeStack.scopeNode)
          if (
            !setupScope ||
            !setupScope.afterAwait ||
            !isInRange(setupScope.range, node)
          ) {
            return
          }
          const { isContextReferenceId, isExposeReferenceId } = setupScope
          if (
            node.callee.type === 'Identifier' &&
            isExposeReferenceId(node.callee, node)
          ) {
            // setup(props,{expose}) {expose()}
            context.report({
              node,
              messageId: 'forbidden',
              data: {
                name: node.callee.name
              }
            })
          } else {
            const expose = getCalleeMemberNode(node)
            if (
              expose &&
              expose.name === 'expose' &&
              expose.member.object.type === 'Identifier' &&
              isContextReferenceId(expose.member.object)
            ) {
              // setup(props,context) {context.emit()}
              context.report({
                node,
                messageId: 'forbidden',
                data: {
                  name: expose.name
                }
              })
            }
          }
        }
      },
      (() => {
        const scriptSetup = getScriptSetupElement(context)
        if (!scriptSetup) {
          return {}
        }
        return {
          Program(node: Program) {
            setupScopes.set(node, {
              afterAwait: false,
              range: scriptSetup.range,
              isExposeReferenceId: (id: any, callNode: any) =>
                callNode.parent.type === 'ExpressionStatement' &&
                callNode.parent.parent === node &&
                id.name === 'defineExpose',
              isContextReferenceId: () => false
            })
          }
        }
      })(),
      defineVueVisitor(context, {
        onSetupFunctionEnter(node: any) {
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
            const exposeProperty = findAssignmentProperty(
              contextParam,
              'expose'
            )
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
          setupScopes.set(node, {
            afterAwait: false,
            range: node.range,
            isExposeReferenceId: (id: any) => exposeReferenceIds.has(id),
            isContextReferenceId: (id: any) => contextReferenceIds.has(id)
          })
        },
        onSetupFunctionExit(node: any) {
          setupScopes.delete(node)
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
