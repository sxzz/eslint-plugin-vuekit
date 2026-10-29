/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  ArrowFunctionExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  RuleContext,
  SpreadElement
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  defineVueVisitor,
  getComponentPropsFromOptions,
  findProperty
} from '../utils/index.ts'

function isFunctionIdentifier(node: Expression | SpreadElement | null) {
  return node && node.type === 'Identifier' && node.name === 'Function'
}

function hasFunctionType(node: Expression) {
  if (isFunctionIdentifier(node)) {
    return true
  }
  return node.type === 'ArrayExpression'
    ? node.elements.some(isFunctionIdentifier)
    : false
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow deprecated `this` access in props default function (in Vue.js 3.0.0+)',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-props-default-this.html'
    },
    schema: [],
    messages: {
      deprecated:
        'Props default value factory functions no longer have access to `this`.'
    }
  },

  create(context: RuleContext) {
    const propsDefault = new Set()
    type ScopeStack = {
      upper: ScopeStack | null
      node: FunctionExpression | FunctionDeclaration
      propDefault: boolean
    }

    let scopeStack: ScopeStack | null = null

    function onFunctionEnter(
      node: FunctionExpression | FunctionDeclaration | ArrowFunctionExpression
    ) {
      if (node.type === 'ArrowFunctionExpression') {
        return
      }
      if (scopeStack) {
        scopeStack = {
          upper: scopeStack,
          node,
          propDefault: false
        }
      } else if (node.type === 'FunctionExpression' && propsDefault.has(node)) {
        scopeStack = {
          upper: scopeStack,
          node,
          propDefault: true
        }
      }
    }

    function onFunctionExit(
      node: FunctionExpression | FunctionDeclaration | ArrowFunctionExpression
    ) {
      if (scopeStack && scopeStack.node === node) {
        scopeStack = scopeStack.upper
      }
    }

    return defineVueVisitor(context, {
      onVueObjectEnter(node: any) {
        for (const prop of getComponentPropsFromOptions(node)) {
          if (
            prop.type !== 'object' ||
            prop.value.type !== 'ObjectExpression'
          ) {
            continue
          }
          const def = findProperty(prop.value, 'default')
          if (!def) {
            continue
          }
          const type = findProperty(prop.value, 'type')
          if (type && hasFunctionType(type.value)) {
            // ignore function type
            continue
          }
          if (def.value.type !== 'FunctionExpression') {
            continue
          }
          propsDefault.add(def.value)
        }
      },
      ':function': onFunctionEnter,
      ':function:exit': onFunctionExit,
      ThisExpression(node: any) {
        if (scopeStack && scopeStack.propDefault) {
          context.report({
            node,
            messageId: 'deprecated'
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
