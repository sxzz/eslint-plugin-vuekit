/**
 * @author Perry Song
 * @copyright 2023 Perry Song. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { Program, RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { isVElement, hasDirective } from '../utils/index.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow `v-if` directives on root element',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-root-v-if.html'
    },
    schema: [],
    messages: {
      noRootVIf: '`v-if` should not be used on root element without `v-else`.'
    }
  },

  create(context: RuleContext) {
    return {
      Program(program: Program) {
        const element = program.templateBody
        if (element == null) {
          return
        }

        const rootElements = element.children.filter(isVElement)
        if (rootElements.length === 1 && hasDirective(rootElements[0], 'if')) {
          context.report({
            node: element,
            loc: element.loc,
            messageId: 'noRootVIf'
          })
        }
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
