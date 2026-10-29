/**
 * @fileoverview Disallow usage of button without an explicit type attribute
 * @author Jonathan Santerre <jonathan@santerre.dev>
 */
import type {
  ASTNode,
  RuleContext,
  VAttribute,
  VDirective,
  VElement
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  defineTemplateBodyVisitor,
  getAttribute,
  getDirective
} from '../utils/index.ts'

function isButtonType(type: string) {
  return ['button', 'submit', 'reset'].includes(type)
}

const optionDefaults = {
  button: true,
  submit: true,
  reset: true
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'disallow usage of button without an explicit type attribute',
      categories: null,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/html-button-has-type.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          button: { type: 'boolean' },
          submit: { type: 'boolean' },
          reset: { type: 'boolean' }
        },
        additionalProperties: false
      }
    ],
    messages: {
      missingTypeAttribute: 'Missing an explicit type attribute for button.',
      invalidTypeAttribute:
        '{{value}} is an invalid value for button type attribute.',
      forbiddenTypeAttribute:
        '{{value}} is a forbidden value for button type attribute.',
      emptyTypeAttribute: 'A value must be set for button type attribute.'
    }
  },

  create(context: RuleContext) {
    const configuration = Object.assign({}, optionDefaults, context.options[0])

    function report(node: ASTNode, messageId: string, data?: any) {
      context.report({
        node,
        messageId,
        data
      })
    }

    function validateAttribute(attribute: VAttribute) {
      const value = attribute.value
      if (!value || !value.value) {
        report(value || attribute, 'emptyTypeAttribute')
        return
      }

      const strValue = value.value
      if (!isButtonType(strValue)) {
        report(value, 'invalidTypeAttribute', { value: strValue })
      } else if (!configuration[strValue]) {
        report(value, 'forbiddenTypeAttribute', { value: strValue })
      }
    }

    function validateDirective(directive: VDirective) {
      const value = directive.value
      if (!value || !value.expression) {
        report(value || directive, 'emptyTypeAttribute')
      }
    }

    return defineTemplateBodyVisitor(context, {
      "VElement[rawName='button']"(node: VElement) {
        const typeAttr = getAttribute(node, 'type')
        if (typeAttr) {
          validateAttribute(typeAttr)
          return
        }
        const typeDir = getDirective(node, 'bind', 'type')
        if (typeDir) {
          validateDirective(typeDir)
          return
        }

        report(node.startTag, 'missingTypeAttribute')
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
