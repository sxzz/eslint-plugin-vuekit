/**
 * @author Toru Nagashima
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VDirective } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  defineTemplateBodyVisitor,
  prevElementHasIf,
  hasDirective,
  isEmptyValueDirective
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid `v-else-if` directives',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/valid-v-else-if.html'
    },
    schema: [],
    messages: {
      missingVIf:
        "'v-else-if' directives require being preceded by the element which has a 'v-if' or 'v-else-if' directive.",
      withVIf:
        "'v-else-if' and 'v-if' directives can't exist on the same element.",
      withVElse:
        "'v-else-if' and 'v-else' directives can't exist on the same element.",
      unexpectedArgument: "'v-else-if' directives require no argument.",
      unexpectedModifier: "'v-else-if' directives require no modifier.",
      expectedValue: "'v-else-if' directives require that attribute value."
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='else-if']"(node: VDirective) {
        const element = node.parent.parent

        if (!prevElementHasIf(element)) {
          context.report({
            node,
            messageId: 'missingVIf'
          })
        }
        if (hasDirective(element, 'if')) {
          context.report({
            node,
            messageId: 'withVIf'
          })
        }
        if (hasDirective(element, 'else')) {
          context.report({
            node,
            messageId: 'withVElse'
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
