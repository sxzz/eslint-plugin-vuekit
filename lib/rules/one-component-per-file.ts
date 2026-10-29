/**
 * @fileoverview enforce that each component should be in its own file
 * @author Armano
 */
import type { ObjectExpression, RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import {
  executeOnVueComponent,
  getVueComponentDefinitionType
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce that each component should be in its own file',
      categories: ['vue3-strongly-recommended'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/one-component-per-file.html'
    },
    schema: [],
    messages: {
      tooManyComponents: 'There is more than one component in this file.'
    }
  },

  create(context: RuleContext) {
    const components: ObjectExpression[] = []

    return Object.assign(
      {},
      executeOnVueComponent(context, (node: any, type: any) => {
        if (type === 'definition') {
          const defType = getVueComponentDefinitionType(context, node)
          if (defType === 'mixin') {
            return
          }
        }
        components.push(node)
      }),
      {
        'Program:exit'() {
          if (components.length > 1) {
            for (const node of components) {
              context.report({
                node,
                messageId: 'tooManyComponents'
              })
            }
          }
        }
      }
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
