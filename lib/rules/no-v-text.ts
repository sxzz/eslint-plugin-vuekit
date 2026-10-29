/**
 * @author tyankatsu <https://github.com/tyankatsu0105>
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VDirective } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { defineTemplateBodyVisitor } from '../utils/index.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow use of v-text',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-v-text.html'
    },
    schema: [],
    messages: {
      unexpected: "Don't use 'v-text'."
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='text']"(node: VDirective) {
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
