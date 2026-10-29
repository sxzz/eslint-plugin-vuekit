/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  ArrowFunctionExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  ObjectExpression,
  ReturnStatement,
  RuleContext
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  compositingVisitors,
  defineScriptSetupVisitor,
  defineVueVisitor,
  getComponentEmitsFromOptions
} from '../utils/index.ts'

export type ComponentEmit = import('../utils').ComponentEmit
export type ComponentObjectEmit = import('../utils').ComponentObjectEmit

/**
 * Checks if the given node value is falsy.
 */
function isFalsy(node: Expression) {
  if (node.type === 'Literal') {
    if (node.bigint) {
      return node.bigint === '0'
    }
    if (!node.value) {
      return true
    }
  }

  return (
    node.type === 'Identifier' &&
    (node.name === 'undefined' || node.name === 'NaN')
  )
}
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'enforce that a return statement is present in emits validator',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/return-in-emits-validator.html'
    },
    schema: [],
    messages: {
      expectedTrue:
        'Expected to return a true value in "{{name}}" emits validator.',
      expectedBoolean:
        'Expected to return a boolean value in "{{name}}" emits validator.'
    }
  },

  create(context: RuleContext) {
    type ScopeStack = {
      upper: ScopeStack | null
      functionNode:
        FunctionExpression | FunctionDeclaration | ArrowFunctionExpression
      hasReturnValue: boolean
      possibleOfReturnTrue: boolean
    }

    const emitsValidators: ComponentObjectEmit[] = []

    let scopeStack: ScopeStack | null = null

    function processEmits(emits: ComponentEmit[]) {
      for (const emit of emits) {
        if (emit.type !== 'object' || !emit.value) {
          continue
        }
        if (
          emit.value.type !== 'FunctionExpression' &&
          emit.value.type !== 'ArrowFunctionExpression'
        ) {
          continue
        }
        emitsValidators.push(emit)
      }
    }
    return compositingVisitors(
      defineScriptSetupVisitor(context, {
        onDefineEmitsEnter(_node: any, emits: any) {
          processEmits(emits)
        }
      }),
      defineVueVisitor(context, {
        onVueObjectEnter(obj: ObjectExpression) {
          processEmits(getComponentEmitsFromOptions(obj))
        }
      }),
      {
        ':function'(
          node:
            FunctionExpression | FunctionDeclaration | ArrowFunctionExpression
        ) {
          scopeStack = {
            upper: scopeStack,
            functionNode: node,
            hasReturnValue: false,
            possibleOfReturnTrue: false
          }

          if (!(node.type === 'ArrowFunctionExpression' && node.expression)) {
            return
          }

          scopeStack.hasReturnValue = true

          if (!isFalsy(node.body)) {
            scopeStack.possibleOfReturnTrue = true
          }
        },

        ReturnStatement(node: ReturnStatement) {
          if (!scopeStack || !node.argument) {
            return
          }

          scopeStack.hasReturnValue = true

          if (!isFalsy(node.argument)) {
            scopeStack.possibleOfReturnTrue = true
          }
        },

        ':function:exit'(
          node:
            FunctionExpression | FunctionDeclaration | ArrowFunctionExpression
        ) {
          if (scopeStack && !scopeStack.possibleOfReturnTrue) {
            const emits: any = emitsValidators.find((e) => e.value === node)
            if (emits) {
              context.report({
                node,
                messageId: scopeStack.hasReturnValue
                  ? 'expectedTrue'
                  : 'expectedBoolean',
                data: {
                  name: emits.emitName || 'Unknown'
                }
              })
            }
          }

          scopeStack &&= scopeStack.upper
        }
      }
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
