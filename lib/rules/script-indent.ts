/**
 * @author Toru Nagashima
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { defineVisitor } from '../utils/indent-common.ts'

const rule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'enforce consistent indentation in `<script>`',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/script-indent.html'
    },

    fixable: 'whitespace',
    schema: [
      {
        oneOf: [{ type: 'integer', minimum: 1 }, { enum: ['tab'] }]
      },
      {
        type: 'object',
        properties: {
          baseIndent: { type: 'integer', minimum: 0 },
          switchCase: { type: 'integer', minimum: 0 },
          ignores: {
            type: 'array',
            items: {
              allOf: [
                { type: 'string' },
                { not: { type: 'string', pattern: ':exit$' } },
                { not: { type: 'string', pattern: String.raw`^\s*$` } }
              ]
            },
            uniqueItems: true
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context: RuleContext) {
    return defineVisitor(context, context.sourceCode, {})
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
