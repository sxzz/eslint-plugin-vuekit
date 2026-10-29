/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { defineTemplateBodyVisitor } from '../utils/index.ts'
import slotAttribute from './syntaxes/slot-attribute.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow deprecated `slot` attribute',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-slot-attribute.html'
    },

    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          ignore: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true
          },
          ignoreParents: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      forbiddenSlotAttribute: '`slot` attributes are deprecated.'
    }
  },
  create(context: RuleContext) {
    const templateBodyVisitor = slotAttribute.createTemplateBodyVisitor(context)
    return defineTemplateBodyVisitor(context, templateBodyVisitor)
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
