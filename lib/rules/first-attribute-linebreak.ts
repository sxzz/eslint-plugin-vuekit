/**
 * @fileoverview Enforce the location of first attribute
 * @author Yosuke Ota
 */
import type { RuleContext, VAttribute, VDirective } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

const rule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'enforce the location of first attribute',
      categories: ['vue3-strongly-recommended'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/first-attribute-linebreak.html'
    },
    fixable: 'whitespace',
    schema: [
      {
        type: 'object',
        properties: {
          multiline: { enum: ['below', 'beside', 'ignore'] },
          singleline: { enum: ['below', 'beside', 'ignore'] }
        },
        additionalProperties: false
      }
    ],
    messages: {
      expected: 'Expected a linebreak before this attribute.',
      unexpected: 'Expected no linebreak before this attribute.'
    }
  },

  create(context: RuleContext) {
    const singleline =
      (context.options[0] && context.options[0].singleline) || 'ignore'

    const multiline =
      (context.options[0] && context.options[0].multiline) || 'below'

    const sourceCode = context.sourceCode
    const template =
      sourceCode.parserServices.getTemplateBodyTokenStore &&
      sourceCode.parserServices.getTemplateBodyTokenStore()

    /**
     * Report attribute
     */
    function report(
      firstAttribute: VAttribute | VDirective,
      location: 'below' | 'beside'
    ) {
      context.report({
        node: firstAttribute,
        messageId: location === 'beside' ? 'unexpected' : 'expected',
        fix(fixer: any) {
          const prevToken = template.getTokenBefore(firstAttribute, {
            includeComments: true
          })
          return fixer.replaceTextRange(
            [prevToken.range[1], firstAttribute.range[0]],
            location === 'beside' ? ' ' : '\n'
          )
        }
      })
    }

    return defineTemplateBodyVisitor(context, {
      VStartTag(node: any) {
        const firstAttribute = node.attributes[0]
        const lastAttribute = node.attributes.at(-1)
        if (!firstAttribute || !lastAttribute) return

        const location =
          firstAttribute.loc.start.line === lastAttribute.loc.end.line
            ? singleline
            : multiline
        if (location === 'ignore') {
          return
        }

        if (location === 'beside') {
          if (node.loc.start.line === firstAttribute.loc.start.line) {
            return
          }
        } else {
          if (node.loc.start.line < firstAttribute.loc.start.line) {
            return
          }
        }
        report(firstAttribute, location)
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
