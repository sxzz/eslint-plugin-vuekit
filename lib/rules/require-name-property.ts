/**
 * @fileoverview Require a name property in Vue components
 * @author LukeeeeBennett
 */
import type {
  Property,
  RuleContext,
  SourceCode,
  SpreadElement,
  Token
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import path from 'node:path'
import {
  getStaticPropertyName,
  isScriptSetup,
  executeOnVue,
  getVueComponentDefinitionType
} from '../utils/index.ts'

/**
 * Get the text of the empty indentation part of the line which the given token is on.
 */
function getLineEmptyIndent(sourceCode: SourceCode, token: Token) {
  const LT_CHAR = /[\n\r\u{2028}\u{2029}]/u
  const EMPTY_CHAR = /\s/
  const text = sourceCode.text
  let i = token.range[0] - 1

  while (i >= 0 && !LT_CHAR.test(text[i])) {
    i -= 1
  }
  let j = i
  while (EMPTY_CHAR.test(text[j])) {
    j += 1
  }

  return text.slice(i + 1, j)
}

function isNameProperty(node: Property | SpreadElement) {
  return (
    node.type === 'Property' &&
    getStaticPropertyName(node) === 'name' &&
    !node.computed
  )
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require a name property in Vue components',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/require-name-property.html'
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      missingName: 'Required name property is not set.',
      addName: 'Add name property to component.'
    }
  },

  create(context: RuleContext) {
    if (isScriptSetup(context)) {
      return {}
    }
    return executeOnVue(context, (component: any, type: any) => {
      if (type === 'definition') {
        const defType = getVueComponentDefinitionType(context, component)
        if (defType === 'mixin') {
          return
        }
      }

      if (component.properties.some(isNameProperty)) return

      context.report({
        node: component,
        messageId: 'missingName',
        suggest: [
          {
            messageId: 'addName',
            fix(fixer: any) {
              const extension = path.extname(context.filename)
              const filename = path.basename(context.filename, extension)
              const sourceCode = context.sourceCode
              // fix only when property is not empty
              if (component.properties.length > 0) {
                const firstToken = sourceCode.getFirstToken(
                  component.properties[0]
                )
                const indentText = getLineEmptyIndent(sourceCode, firstToken)
                // insert name property before the first property
                return fixer.insertTextBefore(
                  component.properties[0],
                  `name: '${filename}',\n${indentText}`
                )
              }

              const firstToken = sourceCode.getFirstToken(component)
              const lastToken = sourceCode.getLastToken(component)
              // if the component is empty, insert name property and indent
              if (firstToken.value === '{' && lastToken.value === '}') {
                const indentText = getLineEmptyIndent(sourceCode, firstToken)
                return fixer.replaceTextRange(
                  [firstToken.range[1], lastToken.range[0]],
                  `\n${indentText}  name: '${filename}'\n${indentText}`
                )
              }
              return null
            }
          }
        ]
      })
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
