/**
 * @author Amorites
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  getScriptSetupElement,
  hasAttribute,
  defineScriptSetupVisitor
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce declaration style of `defineProps`',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/define-props-declaration.html'
    },
    schema: [
      {
        enum: ['type-based', 'runtime']
      }
    ],
    messages: {
      hasArg: 'Use type-based declaration instead of runtime declaration.',
      hasTypeArg: 'Use runtime declaration instead of type-based declaration.'
    }
  },

  create(context: RuleContext) {
    const scriptSetup = getScriptSetupElement(context)
    if (!scriptSetup || !hasAttribute(scriptSetup, 'lang', 'ts')) {
      return {}
    }

    const defineType = context.options[0] || 'type-based'
    return defineScriptSetupVisitor(context, {
      onDefinePropsEnter(node: any) {
        switch (defineType) {
          case 'type-based': {
            if (node.arguments.length > 0) {
              context.report({
                node,
                messageId: 'hasArg'
              })
            }
            break
          }

          case 'runtime': {
            const typeArguments =
              'typeArguments' in node ? node.typeArguments : node.typeParameters
            if (typeArguments && typeArguments.params.length > 0) {
              context.report({
                node,
                messageId: 'hasTypeArg'
              })
            }
            break
          }
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
