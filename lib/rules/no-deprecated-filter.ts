/**
 * @author Przemyslaw Falowski (@przemkow)
 * @fileoverview disallow using deprecated filters syntax
 */
import type { RuleContext, VFilterSequenceExpression } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import * as utils from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow using deprecated filters syntax (in Vue.js 3.0.0+)',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-filter.html'
    },
    schema: [],
    messages: {
      noDeprecatedFilter: 'Filters are deprecated.'
    }
  },
  create(context: RuleContext) {
    return utils.defineTemplateBodyVisitor(context, {
      VFilterSequenceExpression(node: VFilterSequenceExpression) {
        context.report({
          node,
          loc: node.loc,
          messageId: 'noDeprecatedFilter'
        })
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
