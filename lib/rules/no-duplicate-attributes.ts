/**
 * @author Toru Nagashima
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VAttribute, VDirective } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

/**
 * Get the name of the given attribute node.
 */
function getName(attribute: VAttribute | VDirective) {
  if (!attribute.directive) {
    return attribute.key.name
  }
  return attribute.key.name.name === 'bind'
    ? (attribute.key.argument &&
        attribute.key.argument.type === 'VIdentifier' &&
        attribute.key.argument.name) ||
        null
    : null
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow duplication of attributes',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/no-duplicate-attributes.html'
    },

    schema: [
      {
        type: 'object',
        properties: {
          allowCoexistClass: {
            type: 'boolean'
          },
          allowCoexistStyle: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      duplicateAttribute: "Duplicate attribute '{{name}}'."
    }
  },

  create(context: RuleContext) {
    const options = context.options[0] || {}
    const shouldAllowCoexistStyle = options.allowCoexistStyle !== false
    const shouldAllowCoexistClass = options.allowCoexistClass !== false

    const directiveNames = new Set()

    const attributeNames = new Set()

    function isDuplicate(name: string, isDirective: boolean) {
      if (
        (shouldAllowCoexistStyle && name === 'style') ||
        (shouldAllowCoexistClass && name === 'class')
      ) {
        return isDirective ? directiveNames.has(name) : attributeNames.has(name)
      }
      return directiveNames.has(name) || attributeNames.has(name)
    }

    return defineTemplateBodyVisitor(context, {
      VStartTag() {
        directiveNames.clear()
        attributeNames.clear()
      },
      VAttribute(node: any) {
        const name = getName(node)
        if (name == null) {
          return
        }

        if (isDuplicate(name, node.directive)) {
          context.report({
            node,
            loc: node.loc,
            messageId: 'duplicateAttribute',
            data: { name }
          })
        }

        if (node.directive) {
          directiveNames.add(name)
        } else {
          attributeNames.add(name)
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
