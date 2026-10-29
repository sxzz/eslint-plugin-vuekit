/**
 * @author kevsommer Kevin Sommer
 * See LICENSE file in root directory for full license.
 */
import type { CallExpression, Property, RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import {
  compositingVisitors,
  executeOnVue,
  findProperty,
  getComponentPropsFromOptions,
  defineScriptSetupVisitor
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce maximum number of props in Vue component',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/max-props.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxProps: {
            type: 'integer',
            minimum: 1
          }
        },
        additionalProperties: false,
        minProperties: 1
      }
    ],
    messages: {
      tooManyProps:
        'Component has too many props ({{propCount}}). Maximum allowed is {{limit}}.'
    }
  },

  create(context: RuleContext) {
    const option = context.options[0] || {}

    function checkMaxNumberOfProps(
      props: import('../utils').ComponentProp[],
      node: CallExpression | Property
    ) {
      const uniqueProps = new Set(props.map((prop: any) => prop.propName))
      const propCount = uniqueProps.size
      if (propCount > option.maxProps && props[0].node) {
        context.report({
          node,
          messageId: 'tooManyProps',
          data: {
            propCount,
            limit: option.maxProps
          }
        })
      }
    }

    return compositingVisitors(
      executeOnVue(context, (node: any) => {
        const propsNode = findProperty(node, 'props')

        if (!propsNode) return

        checkMaxNumberOfProps(getComponentPropsFromOptions(node), propsNode)
      }),
      defineScriptSetupVisitor(context, {
        onDefinePropsEnter(node: any, props: any) {
          checkMaxNumberOfProps(props, node)
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
