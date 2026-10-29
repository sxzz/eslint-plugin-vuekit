/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { Property, RuleContext, RuleFixer } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { executeOnVue, findProperty, isStringLiteral } from '../utils/index.ts'

function fix(fixer: RuleFixer, property: Property, newName: string) {
  if (property.computed) {
    return isStringLiteral(property.key)
      ? fixer.replaceTextRange(
          [property.key.range[0] + 1, property.key.range[1] - 1],
          newName
        )
      : null
  }
  return property.shorthand
    ? fixer.insertTextBefore(property.key, `${newName}:`)
    : fixer.replaceText(property.key, newName)
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow using deprecated `destroyed` and `beforeDestroy` lifecycle hooks (in Vue.js 3.0.0+)',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-destroyed-lifecycle.html'
    },
    fixable: 'code',
    schema: [],
    messages: {
      deprecatedDestroyed:
        'The `destroyed` lifecycle hook is deprecated. Use `unmounted` instead.',
      deprecatedBeforeDestroy:
        'The `beforeDestroy` lifecycle hook is deprecated. Use `beforeUnmount` instead.'
    }
  },

  create(context: RuleContext) {
    return executeOnVue(context, (obj: any) => {
      const destroyed = findProperty(obj, 'destroyed')

      if (destroyed) {
        context.report({
          node: destroyed.key,
          messageId: 'deprecatedDestroyed',
          fix(fixer: any) {
            return fix(fixer, destroyed, 'unmounted')
          }
        })
      }

      const beforeDestroy = findProperty(obj, 'beforeDestroy')
      if (beforeDestroy) {
        context.report({
          node: beforeDestroy.key,
          messageId: 'deprecatedBeforeDestroy',
          fix(fixer: any) {
            return fix(fixer, beforeDestroy, 'beforeUnmount')
          }
        })
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
