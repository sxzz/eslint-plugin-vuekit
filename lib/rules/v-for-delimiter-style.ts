/**
 * @fileoverview enforce `v-for` directive's delimiter style
 * @author Flo Edelmann
 * @copyright 2020 Flo Edelmann. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VForExpression } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

const rule = {
  meta: {
    type: 'layout',
    docs: {
      description: "enforce `v-for` directive's delimiter style",
      categories: undefined,
      url: 'https://eslint.vuejs.org/rules/v-for-delimiter-style.html'
    },
    fixable: 'code',
    schema: [{ enum: ['in', 'of'] }],
    messages: {
      expected:
        "Expected '{{preferredDelimiter}}' instead of '{{usedDelimiter}}' in 'v-for'."
    }
  },

  create(context: RuleContext) {
    const preferredDelimiter = context.options[0] || 'in'

    return defineTemplateBodyVisitor(context, {
      VForExpression(node: VForExpression) {
        const sourceCode = context.sourceCode
        const tokenStore =
          sourceCode.parserServices.getTemplateBodyTokenStore &&
          sourceCode.parserServices.getTemplateBodyTokenStore()

        const lastLeftNode = node.left.at(-1)
        const delimiterToken = tokenStore.getTokenAfter(
          lastLeftNode ?? tokenStore.getFirstToken(node),
          (token: any) => token.type !== 'Punctuator'
        )
        if (!delimiterToken || delimiterToken.value === preferredDelimiter) {
          return
        }

        context.report({
          node,
          loc: node.loc,
          messageId: 'expected',
          data: {
            preferredDelimiter,
            usedDelimiter: delimiterToken.value
          },
          *fix(fixer: any) {
            yield fixer.replaceText(delimiterToken, preferredDelimiter)
          }
        })
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
