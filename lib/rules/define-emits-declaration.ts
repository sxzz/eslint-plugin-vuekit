/**
 * @author Amorites
 * See LICENSE file in root directory for full license.
 */
import type { CallExpression, RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  getScriptSetupElement,
  hasAttribute,
  defineScriptSetupVisitor
} from '../utils/index.ts'

export type TypeNode = import('@typescript-eslint/types').TSESTree.TypeNode

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce declaration style of `defineEmits`',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/define-emits-declaration.html'
    },
    schema: [
      {
        enum: ['type-based', 'type-literal', 'runtime']
      }
    ],
    messages: {
      hasArg: 'Use type based declaration instead of runtime declaration.',
      hasTypeArg: 'Use runtime declaration instead of type based declaration.',
      hasTypeCallArg:
        'Use new type literal declaration instead of the old call signature declaration.'
    }
  },

  create(context: RuleContext) {
    const scriptSetup = getScriptSetupElement(context)
    if (!scriptSetup || !hasAttribute(scriptSetup, 'lang', 'ts')) {
      return {}
    }

    const defineType = context.options[0] || 'type-based'
    return defineScriptSetupVisitor(context, {
      onDefineEmitsEnter(node: any) {
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

          case 'type-literal': {
            verifyTypeLiteral(node)
            break
          }

          case 'runtime': {
            const typeArguments = node.typeArguments
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

    function verifyTypeLiteral(node: CallExpression) {
      if (node.arguments.length > 0) {
        context.report({
          node,
          messageId: 'hasArg'
        })
        return
      }

      const typeArguments = node.typeArguments
      const param = typeArguments?.params[0]
      if (!param) return
      if (param.type === 'TSTypeLiteral') {
        for (const memberNode of (
          param as import('@typescript-eslint/types').TSESTree.TSTypeLiteral
        ).members) {
          if (memberNode.type !== 'TSPropertySignature') {
            context.report({
              node: memberNode,
              messageId: 'hasTypeCallArg'
            })
          }
        }
      } else if (param.type === 'TSFunctionType') {
        context.report({
          node: param,
          messageId: 'hasTypeCallArg'
        })
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
