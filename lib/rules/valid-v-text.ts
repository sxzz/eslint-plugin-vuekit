/**
 * @author Toru Nagashima
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VDirective } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  defineTemplateBodyVisitor,
  isEmptyValueDirective
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid `v-text` directives',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/valid-v-text.html'
    },
    schema: [],
    messages: {
      unexpectedArgument: "'v-text' directives require no argument.",
      unexpectedModifier: "'v-text' directives require no modifier.",
      expectedValue: "'v-text' directives require that attribute value."
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='text']"(node: VDirective) {
        if (node.key.argument) {
          context.report({
            node: node.key.argument,
            messageId: 'unexpectedArgument'
          })
        }
        const lastModifier = node.key.modifiers.at(-1)
        if (lastModifier) {
          context.report({
            node,
            loc: {
              start: node.key.modifiers[0].loc.start,
              end: lastModifier.loc.end
            },
            messageId: 'unexpectedModifier'
          })
        }
        if (!node.value || isEmptyValueDirective(node, context)) {
          context.report({
            node,
            messageId: 'expectedValue'
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
