/**
 * @author Toru Nagashima
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VExpressionContainer } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow mustaches in `<textarea>`',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-textarea-mustache.html'
    },
    schema: [],
    messages: {
      unexpected: "Unexpected mustache. Use 'v-model' instead."
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VElement[rawName='textarea'] VExpressionContainer"(
        node: VExpressionContainer
      ) {
        if (node.parent.type !== 'VElement') {
          return
        }

        context.report({
          node,
          loc: node.loc,
          messageId: 'unexpected'
        })
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
