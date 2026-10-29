/**
 * @author Sosuke Suzuki
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  executeOnVue,
  findProperty,
  iterateWatchHandlerValues
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow using arrow functions to define watcher',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-arrow-functions-in-watch.html'
    },
    schema: [],
    messages: {
      noArrowFunctionsInWatch:
        'You should not use an arrow function to define a watcher.'
    }
  },

  create(context: RuleContext) {
    return executeOnVue(context, (obj: any) => {
      const watchNode = findProperty(obj, 'watch')
      if (watchNode == null) {
        return
      }
      const watchValue = watchNode.value
      if (watchValue.type !== 'ObjectExpression') {
        return
      }
      for (const property of watchValue.properties) {
        if (property.type !== 'Property') {
          continue
        }

        for (const handler of iterateWatchHandlerValues(property)) {
          if (handler.type === 'ArrowFunctionExpression') {
            context.report({
              node: handler,
              messageId: 'noArrowFunctionsInWatch'
            })
          }
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
