/**
 * @author Toru Nagashima
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VDirective } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  defineTemplateBodyVisitor,
  hasDirective,
  isEmptyValueDirective
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid `v-if` directives',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/valid-v-if.html'
    },
    schema: [],
    messages: {
      withVElse:
        "'v-if' and 'v-else' directives can't exist on the same element. You may want 'v-else-if' directives.",
      withVElseIf:
        "'v-if' and 'v-else-if' directives can't exist on the same element.",
      unexpectedArgument: "'v-if' directives require no argument.",
      unexpectedModifier: "'v-if' directives require no modifier.",
      expectedValue: "'v-if' directives require that attribute value."
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='if']"(node: VDirective) {
        const element = node.parent.parent

        if (hasDirective(element, 'else')) {
          context.report({
            node,
            messageId: 'withVElse'
          })
        }
        if (hasDirective(element, 'else-if')) {
          context.report({
            node,
            messageId: 'withVElseIf'
          })
        }
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
