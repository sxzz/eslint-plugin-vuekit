/**
 * @author Yosuke Ota
 * issue https://github.com/vuejs/eslint-plugin-vue/issues/460
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

const rule = {
  meta: {
    type: 'layout',
    docs: {
      description: 'disallow spaces around equal signs in attribute',
      categories: ['vue3-strongly-recommended'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-spaces-around-equal-signs-in-attribute.html'
    },
    fixable: 'whitespace',
    schema: [],
    messages: {
      unexpectedSpaces: 'Unexpected spaces found around equal signs.'
    }
  },

  create(context: RuleContext) {
    const sourceCode = context.sourceCode
    return defineTemplateBodyVisitor(context, {
      VAttribute(node: any) {
        if (!node.value) {
          return
        }

        const range = [node.key.range[1], node.value.range[0]]
        const eqText = sourceCode.text.slice(range[0], range[1])
        const expect = eqText.trim()

        if (eqText !== expect) {
          context.report({
            node: node.key,
            loc: {
              start: node.key.loc.end,
              end: node.value.loc.start
            },
            messageId: 'unexpectedSpaces',
            fix: (fixer: any) => fixer.replaceTextRange(range, expect)
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
