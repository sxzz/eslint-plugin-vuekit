/**
 * @fileoverview Enforces render function to always return value.
 * @author Armano
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  compositingVisitors,
  defineVueVisitor,
  executeOnFunctionsWithoutReturn
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce render function to always return value',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/require-render-return.html'
    },
    schema: [],
    messages: {
      expectedReturn: 'Expected to return a value in render function.'
    }
  },

  create(context: RuleContext) {
    const renderFunctions = new Map()

    return compositingVisitors(
      defineVueVisitor(context, {
        onRenderFunctionEnter(node: any) {
          renderFunctions.set(node, node.parent.key)
        }
      }),
      executeOnFunctionsWithoutReturn(context, true, (node: any) => {
        const key = renderFunctions.get(node)
        if (key) {
          context.report({
            node: key,
            messageId: 'expectedReturn'
          })
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
