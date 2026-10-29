/**
 * @fileoverview enforce valid `v-is` directives
 * @author Yosuke Ota
 */
import type { RuleContext, VElement } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  isHtmlElementNode,
  isHtmlWellKnownElementName,
  defineTemplateBodyVisitor,
  isEmptyValueDirective
} from '../utils/index.ts'

/**
 * Check whether the given node is valid or not.
 */
function isValidElement(node: VElement) {
  return !isHtmlElementNode(node) || isHtmlWellKnownElementName(node.rawName)
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid `v-is` directives',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/valid-v-is.html'
    },
    schema: [],
    messages: {
      unexpectedArgument: "'v-is' directives require no argument.",
      unexpectedModifier: "'v-is' directives require no modifier.",
      expectedValue: "'v-is' directives require that attribute value.",
      ownerMustBeHTMLElement:
        "'v-is' directive must be owned by a native HTML element, but '{{name}}' is not."
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='is']"(node: any) {
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

        const element = node.parent.parent

        if (isValidElement(element)) {
          return
        }

        const name = element.name
        context.report({
          node,
          messageId: 'ownerMustBeHTMLElement',
          data: { name }
        })
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
