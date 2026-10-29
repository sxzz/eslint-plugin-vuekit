/**
 * @fileoverview Enforce line breaks style after opening and before closing block-level tags.
 * @author Yosuke Ota
 */
import type {
  Program,
  RuleContext,
  VElement,
  VEndTag,
  VStartTag
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import {
  defineTemplateBodyVisitor,
  hasInvalidEOF,
  isVElement
} from '../utils/index.ts'

export type OptionType = 'always' | 'never' | 'consistent' | 'ignore'
export type ContentsOptions = {
  singleline?: OptionType
  multiline?: OptionType
  maxEmptyLines?: number
}
export type Options = ContentsOptions & {
  blocks?: { [element: string]: ContentsOptions }
}
export type ArgsOptions = Required<ContentsOptions>

function getLinebreakCount(text: string) {
  return text.split(/\r\n|[\r\n\u{2028}\u{2029}]/gu).length - 1
}

function getPhrase(lineBreaks: number) {
  switch (lineBreaks) {
    case 1: {
      return '1 line break'
    }
    default: {
      return `${lineBreaks} line breaks`
    }
  }
}

const ENUM_OPTIONS = { enum: ['always', 'never', 'consistent', 'ignore'] }
const rule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'enforce line breaks after opening and before closing block-level tags',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/block-tag-newline.html'
    },
    fixable: 'whitespace',
    schema: [
      {
        type: 'object',
        properties: {
          singleline: ENUM_OPTIONS,
          multiline: ENUM_OPTIONS,
          maxEmptyLines: { type: 'number', minimum: 0 },
          blocks: {
            type: 'object',
            patternProperties: {
              '^(?:\\S+)$': {
                type: 'object',
                properties: {
                  singleline: ENUM_OPTIONS,
                  multiline: ENUM_OPTIONS,
                  maxEmptyLines: { type: 'number', minimum: 0 }
                },
                additionalProperties: false
              }
            },
            additionalProperties: false
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      unexpectedOpeningLinebreak:
        "There should be no line break after '<{{tag}}>'.",
      expectedOpeningLinebreak:
        "Expected {{expected}} after '<{{tag}}>', but {{actual}} found.",
      expectedClosingLinebreak:
        "Expected {{expected}}  before '</{{tag}}>', but {{actual}} found.",
      missingOpeningLinebreak: "A line break is required after '<{{tag}}>'.",
      missingClosingLinebreak: "A line break is required before '</{{tag}}>'."
    }
  },

  create(context: RuleContext) {
    const sourceCode = context.sourceCode
    const df =
      sourceCode.parserServices.getDocumentFragment &&
      sourceCode.parserServices.getDocumentFragment()
    if (!df) {
      return {}
    }

    function verifyBeforeSpaces(
      startTag: VStartTag,
      beforeText: string,
      beforeLinebreakCount: number,
      beforeOption: 'always' | 'never',
      maxEmptyLines: number
    ) {
      if (beforeOption === 'always') {
        if (beforeLinebreakCount === 0) {
          context.report({
            loc: {
              start: startTag.loc.end,
              end: startTag.loc.end
            },
            messageId: 'missingOpeningLinebreak',
            data: { tag: startTag.parent.name },
            fix(fixer: any) {
              return fixer.insertTextAfter(startTag, '\n')
            }
          })
        } else if (maxEmptyLines < beforeLinebreakCount - 1) {
          context.report({
            loc: {
              start: startTag.loc.end,
              end: sourceCode.getLocFromIndex(
                startTag.range[1] + beforeText.length
              )
            },
            messageId: 'expectedOpeningLinebreak',
            data: {
              tag: startTag.parent.name,
              expected: getPhrase(maxEmptyLines + 1),
              actual: getPhrase(beforeLinebreakCount)
            },
            fix(fixer: any) {
              return fixer.replaceTextRange(
                [startTag.range[1], startTag.range[1] + beforeText.length],
                '\n'.repeat(maxEmptyLines + 1)
              )
            }
          })
        }
      } else {
        if (beforeLinebreakCount > 0) {
          context.report({
            loc: {
              start: startTag.loc.end,
              end: sourceCode.getLocFromIndex(
                startTag.range[1] + beforeText.length
              )
            },
            messageId: 'unexpectedOpeningLinebreak',
            data: { tag: startTag.parent.name },
            fix(fixer: any) {
              return fixer.removeRange([
                startTag.range[1],
                startTag.range[1] + beforeText.length
              ])
            }
          })
        }
      }
    }

    function verifyAfterSpaces(
      endTag: VEndTag,
      afterText: string,
      afterLinebreakCount: number,
      afterOption: 'always' | 'never',
      maxEmptyLines: number
    ) {
      if (afterOption === 'always') {
        if (afterLinebreakCount === 0) {
          context.report({
            loc: {
              start: endTag.loc.start,
              end: endTag.loc.start
            },
            messageId: 'missingClosingLinebreak',
            data: { tag: endTag.parent.name },
            fix(fixer: any) {
              return fixer.insertTextBefore(endTag, '\n')
            }
          })
        } else if (maxEmptyLines < afterLinebreakCount - 1) {
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(
                endTag.range[0] - afterText.length
              ),
              end: endTag.loc.start
            },
            messageId: 'expectedClosingLinebreak',
            data: {
              tag: endTag.parent.name,
              expected: getPhrase(maxEmptyLines + 1),
              actual: getPhrase(afterLinebreakCount)
            },
            fix(fixer: any) {
              return fixer.replaceTextRange(
                [endTag.range[0] - afterText.length, endTag.range[0]],
                '\n'.repeat(maxEmptyLines + 1)
              )
            }
          })
        }
      } else {
        if (afterLinebreakCount > 0) {
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(
                endTag.range[0] - afterText.length
              ),
              end: endTag.loc.start
            },
            messageId: 'unexpectedOpeningLinebreak',
            data: { tag: endTag.parent.name },
            fix(fixer: any) {
              return fixer.removeRange([
                endTag.range[0] - afterText.length,
                endTag.range[0]
              ])
            }
          })
        }
      }
    }

    function verifyElement(element: VElement, options: ArgsOptions) {
      const { startTag, endTag } = element
      if (endTag == null || startTag.selfClosing) {
        return
      }
      const text = sourceCode.text.slice(startTag.range[1], endTag.range[0])

      const trimText = text.trim()
      if (!trimText) {
        return
      }

      const option =
        options.multiline !== options.singleline &&
        /[\n\r\u{2028}\u{2029}]/u.test(text.trim())
          ? options.multiline
          : options.singleline
      if (option === 'ignore') {
        return
      }
      const beforeText = /^\s*/u.exec(text)?.[0] ?? ''
      const afterText = /\s*$/u.exec(text)?.[0] ?? ''
      const beforeLinebreakCount = getLinebreakCount(beforeText)
      const afterLinebreakCount = getLinebreakCount(afterText)

      let beforeOption: 'always' | 'never'

      let afterOption: 'always' | 'never'
      if (option === 'always' || option === 'never') {
        beforeOption = option
        afterOption = option
      } else {
        // consistent
        if (beforeLinebreakCount > 0 === afterLinebreakCount > 0) {
          return
        }
        beforeOption = 'always'
        afterOption = 'always'
      }

      verifyBeforeSpaces(
        startTag,
        beforeText,
        beforeLinebreakCount,
        beforeOption,
        options.maxEmptyLines
      )

      verifyAfterSpaces(
        endTag,
        afterText,
        afterLinebreakCount,
        afterOption,
        options.maxEmptyLines
      )
    }

    /**
     * Normalizes a given option value.
     */
    function normalizeOptionValue(option: Options | undefined) {
      if (!option) {
        return normalizeOptionValue({})
      }

      const contentsOptions = option

      const options: ArgsOptions = {
        singleline: contentsOptions.singleline || 'consistent',
        multiline: contentsOptions.multiline || 'always',
        maxEmptyLines: contentsOptions.maxEmptyLines || 0
      }
      const { blocks } = option
      if (!blocks) {
        return (element: any) => verifyElement(element, options)
      }

      return (element: any) => {
        const { name } = element
        const elementsOptions = blocks[name]
        if (elementsOptions) {
          normalizeOptionValue({
            singleline: elementsOptions.singleline || options.singleline,
            multiline: elementsOptions.multiline || options.multiline,
            maxEmptyLines:
              elementsOptions.maxEmptyLines ?? options.maxEmptyLines
          })(element)
        } else {
          verifyElement(element, options)
        }
      }
    }

    const documentFragment = df

    const verify = normalizeOptionValue(context.options[0])

    return defineTemplateBodyVisitor(
      context,
      {},
      {
        Program(node: Program) {
          if (hasInvalidEOF(node)) {
            return
          }

          for (const element of documentFragment.children) {
            if (isVElement(element)) {
              verify(element)
            }
          }
        }
      }
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
