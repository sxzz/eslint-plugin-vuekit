/**
 * @author Valentin Yushkevich
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import * as utils from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow default values in `defineModel`',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-define-model-default.html'
    },
    schema: [],
    messages: {
      unexpected: 'Unexpected default value for the "{{name}}" model.'
    }
  },
  create(context: RuleContext) {
    return utils.defineScriptSetupVisitor(context, {
      onDefineModelEnter(_node, model) {
        const options = model.options && utils.skipTSAsExpression(model.options)
        if (options?.type !== 'ObjectExpression') {
          return
        }
        const defaultProperty = utils.findProperty(options, 'default')
        if (defaultProperty) {
          context.report({
            node: defaultProperty,
            messageId: 'unexpected',
            data: { name: model.name.modelName }
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
