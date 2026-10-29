/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import * as utils from '../utils/index.ts'
import vIs from './syntaxes/v-is.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow deprecated `v-is` directive (in Vue.js 3.1.0+)',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-v-is.html'
    },
    schema: [],
    messages: {
      forbiddenVIs: '`v-is` directive is deprecated.'
    }
  },
  create(context: RuleContext) {
    const templateBodyVisitor = vIs.createTemplateBodyVisitor(context)
    return utils.defineTemplateBodyVisitor(context, templateBodyVisitor)
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
