/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import * as utils from '../utils/index.ts'
import scopeAttribute from './syntaxes/scope-attribute.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow deprecated `scope` attribute',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-scope-attribute.html'
    },

    fixable: 'code',
    schema: [],
    messages: {
      forbiddenScopeAttribute: '`scope` attributes are deprecated.'
    }
  },
  create(context: RuleContext) {
    const templateBodyVisitor =
      scopeAttribute.createTemplateBodyVisitor(context)
    return utils.defineTemplateBodyVisitor(context, templateBodyVisitor)
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
