/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VEndTag, VStartTag } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineDocumentVisitor } from '../utils/index.ts'

function getPhrase(lineBreaks: number) {
  switch (lineBreaks) {
    case 0: {
      return 'no line breaks'
    }
    case 1: {
      return '1 line break'
    }
    default: {
      return `${lineBreaks} line breaks`
    }
  }
}

export type LineBreakBehavior = 'always' | 'never'

export type LineType = 'singleline' | 'multiline'

export type RuleOptions = {
  singleline: LineBreakBehavior
  multiline: LineBreakBehavior
  selfClosingTag: {
    singleline: LineBreakBehavior
    multiline: LineBreakBehavior
  }
}

function getExpectedLineBreaks(
  node: VStartTag | VEndTag,
  options: RuleOptions,
  type: LineType
) {
  const isSelfClosingTag = node.type === 'VStartTag' && node.selfClosing
  if (
    isSelfClosingTag &&
    options.selfClosingTag &&
    options.selfClosingTag[type]
  ) {
    return options.selfClosingTag[type] === 'always' ? 1 : 0
  }

  return options[type] === 'always' ? 1 : 0
}

const rule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        "require or disallow a line break before tag's closing brackets",
      categories: ['vue3-strongly-recommended'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/html-closing-bracket-newline.html'
    },
    fixable: 'whitespace',
    schema: [
      {
        type: 'object',
        properties: {
          singleline: { enum: ['always', 'never'] },
          multiline: { enum: ['always', 'never'] },
          selfClosingTag: {
            type: 'object',
            properties: {
              singleline: { enum: ['always', 'never'] },
              multiline: { enum: ['always', 'never'] }
            },
            additionalProperties: false,
            minProperties: 1
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      expectedBeforeClosingBracket:
        'Expected {{expected}} before closing bracket, but {{actual}} found.'
    }
  },

  create(context: RuleContext) {
    const options = Object.assign(
      {},
      {
        singleline: 'never',
        multiline: 'always'
      },
      context.options[0] || {}
    )
    const sourceCode = context.sourceCode
    const template =
      sourceCode.parserServices.getTemplateBodyTokenStore &&
      sourceCode.parserServices.getTemplateBodyTokenStore()

    return defineDocumentVisitor(context, {
      'VStartTag, VEndTag'(node: VStartTag | VEndTag) {
        const closingBracketToken = template.getLastToken(node)
        if (
          closingBracketToken.type !== 'HTMLSelfClosingTagClose' &&
          closingBracketToken.type !== 'HTMLTagClose'
        ) {
          return
        }

        const prevToken = template.getTokenBefore(closingBracketToken)
        const type =
          node.loc.start.line === prevToken.loc.end.line
            ? 'singleline'
            : 'multiline'

        const expectedLineBreaks = getExpectedLineBreaks(node, options, type)

        const actualLineBreaks =
          closingBracketToken.loc.start.line - prevToken.loc.end.line

        if (actualLineBreaks !== expectedLineBreaks) {
          context.report({
            node,
            loc: {
              start: prevToken.loc.end,
              end: closingBracketToken.loc.start
            },
            messageId: 'expectedBeforeClosingBracket',
            data: {
              expected: getPhrase(expectedLineBreaks),
              actual: getPhrase(actualLineBreaks)
            },
            fix(fixer: any) {
              const range = [prevToken.range[1], closingBracketToken.range[0]]
              const text = '\n'.repeat(expectedLineBreaks)
              return fixer.replaceTextRange(range, text)
            }
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
