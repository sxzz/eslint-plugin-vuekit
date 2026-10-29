/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import * as utils from '../utils/index.ts'
import slotScopeAttribute from './syntaxes/slot-scope-attribute.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow deprecated `slot-scope` attribute',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-slot-scope-attribute.html'
    },

    fixable: 'code',
    schema: [],
    messages: {
      forbiddenSlotScopeAttribute: '`slot-scope` are deprecated.'
    }
  },
  create(context: RuleContext) {
    const templateBodyVisitor = slotScopeAttribute.createTemplateBodyVisitor(
      context,
      { fixToUpgrade: true }
    )
    return utils.defineTemplateBodyVisitor(context, templateBodyVisitor)
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
