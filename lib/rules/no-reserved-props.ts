/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import type { ComponentProp } from '../utils/index.ts'
import {
  compositingVisitors,
  defineScriptSetupVisitor,
  executeOnVue,
  getComponentPropsFromOptions
} from '../utils/index.ts'
import { kebabCase } from '../utils/casing.ts'

const RESERVED = new Set(['key', 'ref'])

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow reserved names in props',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-reserved-props.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          vueVersion: { enum: [3] }
        },
        additionalProperties: false
      }
    ],
    messages: {
      reserved:
        "'{{propName}}' is a reserved attribute and cannot be used as props."
    }
  },
  create(context: RuleContext) {
    function processProps(props: ComponentProp[]) {
      for (const prop of props) {
        if (prop.propName != null && RESERVED.has(prop.propName)) {
          context.report({
            node: prop.node,
            messageId: `reserved`,
            data: {
              propName: kebabCase(prop.propName)
            }
          })
        }
      }
    }

    return compositingVisitors(
      defineScriptSetupVisitor(context, {
        onDefinePropsEnter(_node, props) {
          processProps(props)
        }
      }),
      executeOnVue(context, (obj) => {
        processProps(getComponentPropsFromOptions(obj))
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
