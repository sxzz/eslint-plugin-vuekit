/**
 * @author Toru Nagashima
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VElement } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor, hasDirective } from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'require `v-bind:is` of `<component>` elements',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/require-component-is.html'
    },
    schema: [],
    messages: {
      requireComponentIs:
        "Expected '<component>' elements to have 'v-bind:is' attribute."
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VElement[name='component']"(node: VElement) {
        if (!hasDirective(node, 'bind', 'is')) {
          context.report({
            node,
            loc: node.loc,
            messageId: 'requireComponentIs'
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
