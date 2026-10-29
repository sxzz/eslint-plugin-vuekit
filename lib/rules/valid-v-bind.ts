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

const VALID_MODIFIERS = new Set(['prop', 'camel', 'sync', 'attr'])

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid `v-bind` directives',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/valid-v-bind.html'
    },
    schema: [],
    messages: {
      unsupportedModifier:
        "'v-bind' directives don't support the modifier '{{name}}'.",
      expectedValue: "'v-bind' directives require an attribute value."
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='bind']"(node: VDirective) {
        for (const modifier of node.key.modifiers) {
          if (!VALID_MODIFIERS.has(modifier.name)) {
            context.report({
              node: modifier,
              messageId: 'unsupportedModifier',
              data: { name: modifier.name }
            })
          }
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
