/**
 * @fileoverview enforce valid `nextTick` function calls
 * @author Flo Edelmann
 * @copyright 2021 Flo Edelmann. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule
} from '../types/rule.ts'

import type { CallExpression, Identifier, RuleContext } from '../types/index.ts'

import { isThis, getScope, defineVueVisitor } from '../utils/index.ts'
import { findVariable } from '@eslint-community/eslint-utils'

function getVueNextTickNode(identifier: Identifier, context: RuleContext) {
  // Instance API: this.$nextTick()
  if (
    identifier.name === '$nextTick' &&
    identifier.parent.type === 'MemberExpression' &&
    isThis(identifier.parent.object, context)
  ) {
    return identifier.parent
  }

  // import { nextTick as nt } from 'vue'; nt()
  const variable = (findVariable as unknown as WithVue<typeof findVariable>)(
    getScope(context, identifier),
    identifier
  )

  if (variable != null && variable.defs.length === 1) {
    const def = variable.defs[0]
    if (
      def.type === 'ImportBinding' &&
      def.node.type === 'ImportSpecifier' &&
      def.node.imported.type === 'Identifier' &&
      def.node.imported.name === 'nextTick' &&
      def.node.parent.type === 'ImportDeclaration' &&
      def.node.parent.source.value === 'vue'
    ) {
      return identifier
    }
  }

  return undefined
}

function isAwaitedPromise(callExpression: CallExpression): boolean {
  switch (callExpression.parent.type) {
    // cases like `await nextTick()`
    case 'AwaitExpression': {
      return true
    }

    // cases like `return nextTick()`
    case 'ReturnStatement': {
      return true
    }

    // cases like `() => nextTick()`
    case 'ArrowFunctionExpression': {
      return callExpression.parent.body === callExpression
    }

    // cases like `nextTick().then()`
    case 'MemberExpression': {
      return (
        callExpression.parent.property.type === 'Identifier' &&
        callExpression.parent.property.name === 'then'
      )
    }

    // cases like `let foo = nextTick()` or `foo = nextTick()`
    case 'VariableDeclarator':
    case 'AssignmentExpression': {
      return true
    }

    // cases like `Promise.all([nextTick()])`
    case 'ArrayExpression': {
      return (
        callExpression.parent.parent.type === 'CallExpression' &&
        callExpression.parent.parent.callee.type === 'MemberExpression' &&
        callExpression.parent.parent.callee.object.type === 'Identifier' &&
        callExpression.parent.parent.callee.object.name === 'Promise' &&
        callExpression.parent.parent.callee.property.type === 'Identifier'
      )
    }
  }

  return false
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid `nextTick` function calls',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/valid-next-tick.html'
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [],
    messages: {
      shouldBeFunction: '`nextTick` is a function.',
      missingCallbackOrAwait:
        'Await the Promise returned by `nextTick` or pass a callback function.',
      addAwait: 'Add missing `await` statement.',
      tooManyParameters: '`nextTick` expects zero or one parameters.',
      eitherAwaitOrCallback:
        'Either await the Promise or pass a callback function to `nextTick`.'
    }
  },

  create(context: RuleContext) {
    return defineVueVisitor(context, {
      Identifier(node: Identifier) {
        const nextTickNode = getVueNextTickNode(node, context)
        if (!nextTickNode || !nextTickNode.parent) {
          return
        }

        let parentNode = nextTickNode.parent

        // skip conditional expressions like `foo ? nextTick : bar`
        if (parentNode.type === 'ConditionalExpression') {
          parentNode = parentNode.parent
        }

        if (
          parentNode.type === 'CallExpression' &&
          parentNode.callee !== nextTickNode
        ) {
          // cases like `foo.then(nextTick)` are allowed
          return
        }

        if (
          parentNode.type === 'VariableDeclarator' ||
          parentNode.type === 'AssignmentExpression'
        ) {
          // cases like `let foo = nextTick` or `foo = nextTick` are allowed
          return
        }

        if (parentNode.type !== 'CallExpression') {
          context.report({
            node,
            messageId: 'shouldBeFunction',
            fix(fixer: any) {
              return fixer.insertTextAfter(node, '()')
            }
          })
          return
        }

        if (parentNode.arguments.length === 0) {
          if (!isAwaitedPromise(parentNode)) {
            context.report({
              node,
              messageId: 'missingCallbackOrAwait',
              suggest: [
                {
                  messageId: 'addAwait',
                  fix(fixer: any) {
                    return fixer.insertTextBefore(parentNode, 'await ')
                  }
                }
              ]
            })
          }
          return
        }

        if (parentNode.arguments.length > 1) {
          context.report({
            node,
            messageId: 'tooManyParameters'
          })
          return
        }

        if (isAwaitedPromise(parentNode)) {
          context.report({
            node,
            messageId: 'eitherAwaitOrCallback'
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
