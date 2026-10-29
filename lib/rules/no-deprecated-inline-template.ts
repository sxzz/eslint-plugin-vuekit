/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VIdentifier } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import * as utils from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow using deprecated `inline-template` attribute (in Vue.js 3.0.0+)',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-inline-template.html'
    },
    schema: [],
    messages: {
      unexpected: '`inline-template` are deprecated.'
    }
  },
  create(context: RuleContext) {
    return utils.defineTemplateBodyVisitor(context, {
      "VAttribute[directive=false] > VIdentifier[rawName='inline-template']"(
        node: VIdentifier
      ) {
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
