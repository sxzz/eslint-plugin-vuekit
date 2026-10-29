/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VDirective, VElement } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { isCustomComponent, defineTemplateBodyVisitor } from '../utils/index.ts'
import { pascalCase, kebabCase } from '../utils/casing.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow v-text / v-html on component',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-v-text-v-html-on-component.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: {
            type: 'array',
            items: {
              type: 'string'
            },
            uniqueItems: true
          },
          ignoreElementNamespaces: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      disallow:
        "Using {{directiveName}} on component may break component's content."
    }
  },
  create(context: RuleContext) {
    const options = context.options[0] || {}
    const allow = new Set<string>(options.allow)
    const shouldIgnoreElementNamespaces =
      options.ignoreElementNamespaces === true

    /**
     * Check whether the given node is an allowed component or not.
     * @param node The start tag node to check.
     */
    function isAllowedComponent(node: VElement): boolean {
      const componentName = node.rawName
      return (
        allow.has(componentName) ||
        allow.has(pascalCase(componentName)) ||
        allow.has(kebabCase(componentName))
      )
    }

    /**
     * Verify for v-text and v-html directive
     */
    function verify(node: VDirective) {
      const element = node.parent.parent
      if (
        isCustomComponent(element, shouldIgnoreElementNamespaces) &&
        !isAllowedComponent(element)
      ) {
        context.report({
          node,
          loc: node.loc,
          messageId: 'disallow',
          data: {
            directiveName: `v-${node.key.name.name}`
          }
        })
      }
    }

    return defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='text']": verify,
      "VAttribute[directive=true][key.name.name='html']": verify
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
