/**
 * @author Wayne Zhang
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { defineTemplateBodyVisitor } from '../utils/index.ts'
import { toRegExpGroupMatcher } from '../utils/regexp.ts'
import htmlElements from '../utils/html-elements.json' with { type: 'json' }
import deprecatedHtmlElements from '../utils/deprecated-html-elements.json' with { type: 'json' }
import svgElements from '../utils/svg-elements.json' with { type: 'json' }
import { vue3BuiltinComponents } from '../utils/vue3-builtin-components.ts'

const reservedNames = new Set([
  ...htmlElements,
  ...deprecatedHtmlElements,
  ...svgElements,
  ...vue3BuiltinComponents
])

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce using only specific component names',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/restricted-component-names.html'
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          allow: {
            type: 'array',
            items: { type: 'string' },
            uniqueItems: true
          }
        }
      }
    ],
    messages: {
      invalidName: 'Component name "{{name}}" is not allowed.'
    }
  },
  create(context: RuleContext) {
    const options = context.options[0] || {}
    const isAllowed = toRegExpGroupMatcher(options.allow)

    function isAllowedTarget(name: string) {
      return reservedNames.has(name) || isAllowed(name)
    }

    return defineTemplateBodyVisitor(context, {
      VElement(node) {
        const name = node.rawName
        if (isAllowedTarget(name)) {
          return
        }

        context.report({
          node,
          loc: node.loc,
          messageId: 'invalidName',
          data: {
            name
          }
        })
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
