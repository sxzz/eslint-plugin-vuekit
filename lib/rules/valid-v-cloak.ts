/**
 * @author Toru Nagashima
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VDirective } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid `v-cloak` directives',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/valid-v-cloak.html'
    },
    schema: [],
    messages: {
      unexpectedArgument: "'v-cloak' directives require no argument.",
      unexpectedModifier: "'v-cloak' directives require no modifier.",
      unexpectedValue: "'v-cloak' directives require no attribute value."
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='cloak']"(node: VDirective) {
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
