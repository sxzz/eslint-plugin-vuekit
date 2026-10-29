/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VDirectiveKey, VIdentifier } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import * as utils from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow using deprecated `.native` modifiers (in Vue.js 3.0.0+)',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-v-on-native-modifier.html'
    },
    schema: [],
    messages: {
      deprecated: "'.native' modifier on 'v-on' directive is deprecated."
    }
  },
  create(context: RuleContext) {
    return utils.defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='on'] > VDirectiveKey > VIdentifier[name='native']"(
        node: VIdentifier & { parent: VDirectiveKey }
      ) {
        const key = node.parent
        if (!key.modifiers.includes(node)) return

        context.report({
          node,
          messageId: 'deprecated'
        })
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
