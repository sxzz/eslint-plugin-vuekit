/**
 * @fileoverview disallow using deprecated object declaration on data
 * @author yoyo930021
 */
import type {
  Expression,
  RuleContext,
  SourceCode,
  Token
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { executeOnVue, findProperty } from '../utils/index.ts'

function isOpenParen(token: Token) {
  return token.type === 'Punctuator' && token.value === '('
}

function isCloseParen(token: Token) {
  return token.type === 'Punctuator' && token.value === ')'
}

function getFirstAndLastTokens(node: Expression, sourceCode: SourceCode) {
  let first = sourceCode.getFirstToken(node)
  let last = sourceCode.getLastToken(node)

  // If the value enclosed by parentheses, update the 'first' and 'last' by the parentheses.
  while (true) {
    const prev = sourceCode.getTokenBefore(first)
    const next = sourceCode.getTokenAfter(last)
    if (isOpenParen(prev) && isCloseParen(next)) {
      first = prev
      last = next
    } else {
      return { first, last }
    }
  }
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow using deprecated object declaration on data (in Vue.js 3.0.0+)',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/no-deprecated-data-object-declaration.html'
    },
    fixable: 'code',
    schema: [],
    messages: {
      objectDeclarationIsDeprecated:
        "Object declaration on 'data' property is deprecated. Using function declaration instead."
    }
  },

  create(context: RuleContext) {
    const sourceCode = context.sourceCode
    const validPropertyTypes = new Set([
      'FunctionExpression',
      'ArrowFunctionExpression',
      'Identifier'
    ])

    return executeOnVue(context, (objectExpression: any) => {
      const invalidData = findProperty(
        objectExpression,
        'data',
        (property: any) => !validPropertyTypes.has(property.value.type)
      )

      if (invalidData) {
        context.report({
          node: invalidData,
          messageId: 'objectDeclarationIsDeprecated',
          fix(fixer: any) {
            const tokens = getFirstAndLastTokens(invalidData.value, sourceCode)

            return [
              fixer.insertTextBefore(tokens.first, 'function() {\nreturn '),
              fixer.insertTextAfter(tokens.last, ';\n}')
            ]
          }
        })
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
