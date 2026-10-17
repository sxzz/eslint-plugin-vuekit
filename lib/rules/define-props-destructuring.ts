/**
 * @author Wayne Zhang
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  compositingVisitors,
  defineScriptSetupVisitor,
  isUsingPropsDestructure,
  hasWithDefaults as utilsHasWithDefaults,
  getLeftOfDefineProps
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce consistent style for props destructuring',
      categories: undefined,
      url: 'https://eslint.vuejs.org/rules/define-props-destructuring.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          destructure: {
            enum: ['only-when-assigned', 'always', 'never']
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      preferDestructuring: 'Prefer destructuring from `defineProps` directly.',
      avoidDestructuring: 'Avoid destructuring from `defineProps`.',
      avoidWithDefaults: 'Avoid using `withDefaults` with destructuring.'
    }
  },

  create(context: RuleContext) {
    const options = context.options[0] || {}
    const destructurePreference = options.destructure || 'only-when-assigned'

    return compositingVisitors(
      defineScriptSetupVisitor(context, {
        onDefinePropsEnter(node: any, props: any) {
          const hasArgs = props.some(
            (prop: any) =>
              prop.propName || (prop.type === 'unknown' && prop.node)
          )
          if (!hasArgs) {
            return
          }

          const hasDestructure = isUsingPropsDestructure(node)
          const hasWithDefaults = utilsHasWithDefaults(node)
          const hasAssigned = getLeftOfDefineProps(node) !== null

          if (destructurePreference === 'never') {
            if (hasDestructure) {
              context.report({
                node,
                messageId: 'avoidDestructuring'
              })
            }
            return
          }

          if (
            !hasDestructure &&
            (destructurePreference === 'always' || hasAssigned)
          ) {
            context.report({
              node,
              messageId: 'preferDestructuring'
            })
            return
          }

          if (hasWithDefaults) {
            context.report({
              node: node.parent.callee,
              messageId: 'avoidWithDefaults'
            })
          }
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
