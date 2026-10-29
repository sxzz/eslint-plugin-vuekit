/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { Program, RuleContext, RuleListener } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import * as utils from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow using deprecated the `functional` template (in Vue.js 3.0.0+)',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-functional-template.html'
    },
    schema: [],
    messages: {
      unexpected: 'The `functional` template are deprecated.'
    }
  },
  create(context: RuleContext): RuleListener {
    return {
      Program(program: Program) {
        const element = program.templateBody
        if (element == null) {
          return
        }

        const functional = utils.getAttribute(element, 'functional')

        if (functional) {
          context.report({
            node: functional,
            messageId: 'unexpected'
          })
        }
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
