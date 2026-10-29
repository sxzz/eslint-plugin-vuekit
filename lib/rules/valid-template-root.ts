/**
 * @author Toru Nagashima
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { Program, RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { hasAttribute } from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid template root',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/valid-template-root.html'
    },
    schema: [],
    messages: {
      emptySrc:
        "The template root with 'src' attribute is required to be empty.",
      noChild: 'The template requires child element.'
    }
  },

  create(context: RuleContext) {
    const sourceCode = context.sourceCode

    return {
      Program(program: Program) {
        const element = program.templateBody
        if (element == null) {
          return
        }

        const hasSrc = hasAttribute(element, 'src')
        const rootElements = []

        for (const child of element.children) {
          if (sourceCode.getText(child).trim() !== '') {
            rootElements.push(child)
          }
        }

        if (hasSrc && rootElements.length > 0) {
          for (const element of rootElements) {
            context.report({
              node: element,
              loc: element.loc,
              messageId: 'emptySrc'
            })
          }
        } else if (!hasSrc && rootElements.length === 0) {
          context.report({
            node: element,
            loc: element.loc,
            messageId: 'noChild'
          })
        }
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
