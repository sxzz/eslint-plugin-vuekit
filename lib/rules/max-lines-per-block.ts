/**
 * @author lsdsjy
 * @fileoverview Rule for checking the maximum number of lines in Vue SFC blocks.
 */
import type { Program, RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { SourceCode } from 'eslint'
import { isVElement, hasInvalidEOF } from '../utils/index.ts'

function isEmptyLine(text: string) {
  return !text.trim()
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce maximum number of lines in Vue SFC blocks',
      categories: undefined,
      url: 'https://eslint.vuejs.org/rules/max-lines-per-block.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          style: {
            type: 'integer',
            minimum: 1
          },
          template: {
            type: 'integer',
            minimum: 1
          },
          script: {
            type: 'integer',
            minimum: 1
          },
          skipBlankLines: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      tooManyLines:
        'Block has too many lines ({{lineCount}}). Maximum allowed is {{limit}}.'
    }
  },

  create(context: RuleContext) {
    const option = context.options[0] || {}

    const limits: Record<string, number | undefined> = {
      template: option.template,
      script: option.script,
      style: option.style
    }

    const sourceCode = context.sourceCode
    const documentFragment =
      sourceCode.parserServices.getDocumentFragment &&
      sourceCode.parserServices.getDocumentFragment()

    function getTopLevelHTMLElements() {
      return documentFragment
        ? documentFragment.children.filter(isVElement)
        : []
    }

    return {
      Program(node: Program) {
        if (hasInvalidEOF(node)) {
          return
        }
        for (const block of getTopLevelHTMLElements()) {
          const limit = limits[block.name]
          if (!limit) {
            continue
          }

          // We suppose the start tag and end tag occupy one single line respectively
          let lineCount = block.loc.end.line - block.loc.start.line - 1

          if (option.skipBlankLines) {
            const lines = SourceCode.splitLines(sourceCode.getText(block))
            lineCount -= lines.filter(isEmptyLine).length
          }

          if (lineCount > limit) {
            context.report({
              node: block,
              messageId: 'tooManyLines',
              data: {
                limit,
                lineCount
              }
            })
          }
        }
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
