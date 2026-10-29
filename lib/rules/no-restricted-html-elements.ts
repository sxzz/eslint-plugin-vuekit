/**
 * @author Doug Wade <douglas.b.wade@gmail.com>
 */
import type { RuleContext, VElement } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  defineTemplateBodyVisitor,
  isHtmlElementNode,
  isSvgElementNode,
  isMathElementNode
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow specific elements',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-restricted-html-elements.html'
    },
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { type: 'string' },
          {
            type: 'object',
            properties: {
              element: {
                oneOf: [
                  { type: 'string' },
                  { type: 'array', items: { type: 'string' } }
                ]
              },
              message: { type: 'string', minLength: 1 }
            },
            required: ['element'],
            additionalProperties: false
          }
        ]
      },
      uniqueItems: true,
      minItems: 0
    },
    messages: {
      forbiddenElement: 'Unexpected use of forbidden element {{name}}.',

      customMessage: '{{message}}'
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      VElement(node: VElement) {
        if (
          !isHtmlElementNode(node) &&
          !isSvgElementNode(node) &&
          !isMathElementNode(node)
        ) {
          return
        }

        for (const option of context.options) {
          const restrictedItem = option.element || option
          const elementsToRestrict = Array.isArray(restrictedItem)
            ? restrictedItem
            : [restrictedItem]

          if (elementsToRestrict.includes(node.rawName)) {
            context.report({
              messageId: option.message ? 'customMessage' : 'forbiddenElement',
              data: {
                name: node.rawName,
                message: option.message
              },
              node: node.startTag
            })

            return
          }
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
