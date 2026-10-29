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
  hasDirective
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid `v-else` directives',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/valid-v-else.html'
    },
    schema: [],
    messages: {
      missingVIf:
        "'v-else' directives require being preceded by the element which has a 'v-if' or 'v-else-if' directive.",
      withVIf:
        "'v-else' and 'v-if' directives can't exist on the same element. You may want 'v-else-if' directives.",
      withVElseIf:
        "'v-else' and 'v-else-if' directives can't exist on the same element.",
      unexpectedArgument: "'v-else' directives require no argument.",
      unexpectedModifier: "'v-else' directives require no modifier.",
      unexpectedValue: "'v-else' directives require no attribute value."
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='else']"(node: VDirective) {
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
        if (node.value) {
          context.report({
            node: node.value,
            messageId: 'unexpectedValue'
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
