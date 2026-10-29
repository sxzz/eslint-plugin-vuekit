/**
 * @fileoverview Alphabetizes static class names.
 * @author Maciej Chmurski
 */
import type { RuleContext, VAttribute } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/static-class-names-order.html',
      description: 'enforce static class names order',
      categories: undefined
    },
    fixable: 'code',
    schema: [],
    messages: {
      shouldBeOrdered: 'Classes should be ordered alphabetically.'
    }
  },

  create: (context: RuleContext) =>
    defineTemplateBodyVisitor(context, {
      "VAttribute[directive=false][key.name='class']"(node: VAttribute) {
        const value = node.value
        if (!value) {
          return
        }
        const classList = value.value
        const classListWithWhitespace = classList.split(/(\s+)/)

        // Detect and reuse any type of whitespace.
        const divider =
          classListWithWhitespace.length > 1 ? classListWithWhitespace[1] : ''

        const classListNoWhitespace = classListWithWhitespace.filter(
          (className: any) => className.trim() !== ''
        )
        const classListSorted = classListNoWhitespace
          .sort((a: any, b: any) => a.localeCompare(b))
          .join(divider)

        if (classList !== classListSorted) {
          context.report({
            node,
            loc: node.loc,
            messageId: 'shouldBeOrdered',
            fix: (fixer: any) =>
              fixer.replaceText(value, `"${classListSorted}"`)
          })
        }
      }
    })
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
