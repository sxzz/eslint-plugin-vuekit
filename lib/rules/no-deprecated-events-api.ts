/**
 * @fileoverview disallow using deprecated events api
 * @author yoyo930021
 */
import type {
  CallExpression,
  ChainExpression,
  MemberExpression,
  RuleContext
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  defineVueVisitor,
  skipChainExpression,
  getStaticPropertyName,
  isThis
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow using deprecated events api (in Vue.js 3.0.0+)',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-events-api.html'
    },
    schema: [],
    messages: {
      noDeprecatedEventsApi:
        'The Events api `$on`, `$off` `$once` is deprecated. Using external library instead, for example mitt.'
    }
  },

  create(context: RuleContext) {
    return defineVueVisitor(context, {
      'CallExpression > MemberExpression, CallExpression > ChainExpression > MemberExpression'(
        node: MemberExpression &
          (
            | { parent: CallExpression }
            | { parent: ChainExpression & { parent: CallExpression } }
          )
      ) {
        const call =
          node.parent.type === 'ChainExpression'
            ? node.parent.parent
            : node.parent

        // Optional chaining (e.g. `this.$on?.()`) is OK because checking whether it is deprecated.
        if (
          call.optional ||
          skipChainExpression(call.callee) !== node ||
          !['$on', '$off', '$once'].includes(
            getStaticPropertyName(node) || ''
          ) ||
          !isThis(node.object, context)
        ) {
          return
        }

        context.report({
          node: node.property,
          messageId: 'noDeprecatedEventsApi'
        })
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
