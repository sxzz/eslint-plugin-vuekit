/**
 * @author ItMaga
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineScriptSetupVisitor } from '../utils/index.ts'

const DEFAULT_OPTIONS = {
  defineProps: 'props',
  defineEmits: 'emit',
  defineSlots: 'slots',
  useSlots: 'slots',
  useAttrs: 'attrs'
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require a certain macro variable name',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/require-macro-variable-name.html'
    },
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          defineProps: { type: 'string' },
          defineEmits: { type: 'string' },
          defineSlots: { type: 'string' },
          useSlots: { type: 'string' },
          useAttrs: { type: 'string' }
        },
        additionalProperties: false
      }
    ],
    messages: {
      requireName:
        'The variable name of "{{macroName}}" must be "{{variableName}}".',
      changeName: 'Change the variable name to "{{variableName}}".'
    }
  },

  create(context: RuleContext) {
    const options = Object.assign({}, DEFAULT_OPTIONS, context.options[0])
    const relevantMacros = new Set([
      ...Object.keys(DEFAULT_OPTIONS),
      'withDefaults'
    ])

    return defineScriptSetupVisitor(context, {
      VariableDeclarator(node: any) {
        if (
          !node.init ||
          node.init.type !== 'CallExpression' ||
          node.init.callee.type !== 'Identifier' ||
          !relevantMacros.has(node.init.callee.name)
        ) {
          return
        }

        const macroName =
          node.init.callee.name === 'withDefaults'
            ? 'defineProps'
            : node.init.callee.name

        if (
          node.id.type === 'Identifier' &&
          node.id.name !== options[macroName]
        ) {
          context.report({
            node: node.id,
            loc: node.id.loc,
            messageId: 'requireName',
            data: {
              macroName,
              variableName: options[macroName]
            },
            suggest: [
              {
                messageId: 'changeName',
                data: {
                  variableName: options[macroName]
                },
                fix(fixer: any) {
                  return fixer.replaceText(node.id, options[macroName])
                }
              }
            ]
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
