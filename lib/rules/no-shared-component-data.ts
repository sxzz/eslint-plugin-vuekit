/**
 * @fileoverview Enforces component's data property to be a function.
 * @author Armano
 */
import type {
  Expression,
  RuleContext,
  SourceCode,
  Token
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { executeOnVueComponent, findProperty } from '../utils/index.ts'

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
      description: "enforce component's data property to be a function",
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-shared-component-data.html'
    },
    fixable: 'code',
    schema: [],
    messages: {
      dataPropertyMustBeFunction:
        '`data` property in component must be a function.'
    }
  },

  create(context: RuleContext) {
    const sourceCode = context.sourceCode
    const validPropertyTypes = new Set([
      'FunctionExpression',
      'ArrowFunctionExpression',
      'Identifier'
    ])

    return executeOnVueComponent(context, (objectExpression: any) => {
      const invalidData = findProperty(
        objectExpression,
        'data',
        (property: any) => !validPropertyTypes.has(property.value.type)
      )

      if (invalidData) {
        context.report({
          node: invalidData,
          messageId: 'dataPropertyMustBeFunction',
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
