/**
 * @fileoverview enforce Promise or callback style in `nextTick`
 * @author Flo Edelmann
 * @copyright 2020 Flo Edelmann. All rights reserved.
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

function getVueNextTickCallExpression(
  identifier: Identifier,
  context: RuleContext
) {
  // Instance API: this.$nextTick()
  if (
    identifier.name === '$nextTick' &&
    identifier.parent.type === 'MemberExpression' &&
    isThis(identifier.parent.object, context) &&
    identifier.parent.parent.type === 'CallExpression' &&
    identifier.parent.parent.callee === identifier.parent
  ) {
    return identifier.parent.parent
  }

  // import { nextTick as nt } from 'vue'; nt()
  if (
    identifier.parent.type === 'CallExpression' &&
    identifier.parent.callee === identifier
  ) {
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
        return identifier.parent
      }
    }
  }

  return undefined
}

function isAwaitedPromise(callExpression: CallExpression) {
  return (
    callExpression.parent.type === 'AwaitExpression' ||
    (callExpression.parent.type === 'MemberExpression' &&
      callExpression.parent.property.type === 'Identifier' &&
      callExpression.parent.property.name === 'then')
  )
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce Promise or callback style in `nextTick`',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/next-tick-style.html'
    },
    fixable: 'code',
    schema: [{ enum: ['promise', 'callback'] }],
    messages: {
      usePromise:
        'Use the Promise returned by `nextTick` instead of passing a callback function.',
      useCallback:
        'Pass a callback function to `nextTick` instead of using the returned Promise.'
    }
  },

  create(context: RuleContext) {
    const preferredStyle = context.options[0] || 'promise'

    return defineVueVisitor(context, {
      Identifier(node: Identifier) {
        const callExpression = getVueNextTickCallExpression(node, context)
        if (!callExpression) {
          return
        }

        if (preferredStyle === 'callback') {
          if (
            callExpression.arguments.length !== 1 ||
            isAwaitedPromise(callExpression)
          ) {
            context.report({
              node,
              messageId: 'useCallback'
            })
          }

          return
        }

        if (
          callExpression.arguments.length > 0 ||
          !isAwaitedPromise(callExpression)
        ) {
          context.report({
            node,
            messageId: 'usePromise',
            fix(fixer: any) {
              return fixer.insertTextAfter(node, '().then')
            }
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
