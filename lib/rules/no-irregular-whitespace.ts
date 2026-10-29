/**
 * @author Yosuke Ota
 * @fileoverview Rule to disalow whitespace that is not a tab or space, whitespace inside strings and comments are allowed
 */
import type {
  ASTNode,
  Comment,
  HTMLBogusComment,
  HTMLComment,
  Literal,
  RuleContext,
  TemplateElement,
  Token,
  VLiteral,
  VText
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

const ALL_IRREGULARS =
  /[\f\v\u{85}\u{FEFF}\u{A0}\u{1680}\u{180E}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{200B}\u{202F}\u{205F}\u{3000}\u{2028}\u{2029}]/u
const IRREGULAR_WHITESPACE =
  /[\f\v\u{85}\u{FEFF}\u{A0}\u{1680}\u{180E}\u{2000}\u{2001}\u{2002}\u{2003}\u{2004}\u{2005}\u{2006}\u{2007}\u{2008}\u{2009}\u{200A}\u{200B}\u{202F}\u{205F}\u{3000}]+/gmu
const IRREGULAR_LINE_TERMINATORS = /[\u{2028}\u{2029}]/gmu

const rule = {
  meta: {
    type: 'problem',

    docs: {
      description: 'disallow irregular whitespace in `.vue` files',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-irregular-whitespace.html',
      extensionSource: {
        url: 'https://eslint.org/docs/rules/no-irregular-whitespace',
        name: 'ESLint core'
      }
    },

    schema: [
      {
        type: 'object',
        properties: {
          skipComments: { type: 'boolean' },
          skipStrings: { type: 'boolean' },
          skipTemplates: { type: 'boolean' },
          skipRegExps: { type: 'boolean' },
          skipHTMLAttributeValues: { type: 'boolean' },
          skipHTMLTextContents: { type: 'boolean' }
        },
        additionalProperties: false
      }
    ],
    messages: {
      disallow: 'Irregular whitespace not allowed.'
    }
  },

  create(context: RuleContext) {
    // Module store of error ranges that we have found

    let errorIndices: { start: number; end: number }[] = []

    // Lookup the `skipComments` option, which defaults to `false`.
    const options = context.options[0] || {}
    const shouldSkipComments = Boolean(options.skipComments)
    const shouldSkipStrings = options.skipStrings !== false
    const shouldSkipRegExps = Boolean(options.skipRegExps)
    const shouldSkipTemplates = Boolean(options.skipTemplates)
    const shouldSkipHTMLAttributeValues = Boolean(
      options.skipHTMLAttributeValues
    )
    const shouldSkipHTMLTextContents = Boolean(options.skipHTMLTextContents)

    const sourceCode = context.sourceCode

    /**
     * Removes errors that occur inside a string node
     */
    function removeWhitespaceError(node: ASTNode | Token) {
      const [startIndex, endIndex] = node.range

      errorIndices = errorIndices.filter(
        (error) => error.start < startIndex || endIndex <= error.start
      )
    }

    /**
     * Checks literal nodes for errors that we are choosing to ignore and calls the relevant methods to remove the errors
     */
    function removeInvalidNodeErrorsInLiteral(node: Literal) {
      const shouldCheckStrings =
        shouldSkipStrings && typeof node.value === 'string'
      const shouldCheckRegExps = shouldSkipRegExps && Boolean(node.regex)

      // If we have irregular characters, remove them from the errors list
      if (
        (shouldCheckStrings || shouldCheckRegExps) &&
        ALL_IRREGULARS.test(sourceCode.getText(node))
      ) {
        removeWhitespaceError(node)
      }
    }

    /**
     * Checks template string literal nodes for errors that we are choosing to ignore and calls the relevant methods to remove the errors
     */
    function removeInvalidNodeErrorsInTemplateLiteral(node: TemplateElement) {
      if (ALL_IRREGULARS.test(node.value.raw)) {
        removeWhitespaceError(node)
      }
    }

    /**
     * Checks HTML attribute value nodes for errors that we are choosing to ignore and calls the relevant methods to remove the errors
     */
    function removeInvalidNodeErrorsInHTMLAttributeValue(node: VLiteral) {
      if (ALL_IRREGULARS.test(sourceCode.getText(node))) {
        removeWhitespaceError(node)
      }
    }

    /**
     * Checks HTML text content nodes for errors that we are choosing to ignore and calls the relevant methods to remove the errors
     */
    function removeInvalidNodeErrorsInHTMLTextContent(node: VText) {
      if (ALL_IRREGULARS.test(sourceCode.getText(node))) {
        removeWhitespaceError(node)
      }
    }

    /**
     * Checks comment nodes for errors that we are choosing to ignore and calls the relevant methods to remove the errors
     */
    function removeInvalidNodeErrorsInComment(
      node: Comment | HTMLComment | HTMLBogusComment
    ) {
      if (ALL_IRREGULARS.test(node.value)) {
        removeWhitespaceError(node)
      }
    }

    /**
     * Checks the program source for irregular whitespaces and irregular line terminators
     */
    function checkForIrregularWhitespace() {
      const source = sourceCode.getText()
      let match
      while ((match = IRREGULAR_WHITESPACE.exec(source)) !== null) {
        errorIndices.push({
          start: match.index,
          end: match.index + match[0].length
        })
      }
      while ((match = IRREGULAR_LINE_TERMINATORS.exec(source)) !== null) {
        errorIndices.push({
          start: match.index,
          end: match.index + match[0].length
        })
      }
    }

    checkForIrregularWhitespace()

    if (errorIndices.length === 0) {
      return {}
    }
    const bodyVisitor = defineTemplateBodyVisitor(context, {
      ...(shouldSkipHTMLAttributeValues
        ? {
            'VAttribute[directive=false] > VLiteral':
              removeInvalidNodeErrorsInHTMLAttributeValue
          }
        : {}),
      ...(shouldSkipHTMLTextContents
        ? { VText: removeInvalidNodeErrorsInHTMLTextContent }
        : {}),

      // inline scripts
      Literal: removeInvalidNodeErrorsInLiteral,
      ...(shouldSkipTemplates
        ? { TemplateElement: removeInvalidNodeErrorsInTemplateLiteral }
        : {})
    })
    return {
      ...bodyVisitor,
      Literal: removeInvalidNodeErrorsInLiteral,
      ...(shouldSkipTemplates
        ? { TemplateElement: removeInvalidNodeErrorsInTemplateLiteral }
        : {}),
      'Program:exit'(node: any) {
        if (bodyVisitor['Program:exit']) {
          bodyVisitor['Program:exit'](node)
        }
        const templateBody = node.templateBody
        if (shouldSkipComments) {
          // First strip errors occurring in comment nodes.
          for (const node of sourceCode.getAllComments()) {
            removeInvalidNodeErrorsInComment(node)
          }
          if (templateBody) {
            for (const node of templateBody.comments) {
              removeInvalidNodeErrorsInComment(node)
            }
          }
        }

        // Removes errors that occur outside script and template
        const [scriptStart, scriptEnd] = node.range
        const [templateStart, templateEnd] = templateBody
          ? templateBody.range
          : [0, 0]
        errorIndices = errorIndices.filter(
          (error) =>
            (scriptStart <= error.start && error.start < scriptEnd) ||
            (templateStart <= error.start && error.start < templateEnd)
        )

        // If we have any errors remaining, report on them
        for (const { start, end } of errorIndices) {
          context.report({
            loc: {
              start: sourceCode.getLocFromIndex(start),
              end: sourceCode.getLocFromIndex(end)
            },
            messageId: 'disallow'
          })
        }
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
