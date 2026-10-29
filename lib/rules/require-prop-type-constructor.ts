/**
 * @fileoverview require prop type to be a constructor
 * @author Michał Sajnóg
 */
import type { ESNode, RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  getStringLiteralValue,
  findProperty,
  compositingVisitors,
  defineScriptSetupVisitor,
  executeOnVueComponent,
  getComponentPropsFromOptions,
  isDef
} from '../utils/index.ts'

export type ComponentProp = import('../utils').ComponentProp

const forbiddenTypes = new Set([
  'Literal',
  'TemplateLiteral',
  'BinaryExpression',
  'UpdateExpression'
])

function isForbiddenType(node: ESNode) {
  return (
    forbiddenTypes.has(node.type) &&
    !(node.type === 'Literal' && node.value == null && !node.bigint)
  )
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require prop type to be a constructor',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/require-prop-type-constructor.html'
    },
    fixable: 'code',
    schema: [],
    messages: {
      propTypeConstructor: 'The "{{name}}" property should be a constructor.'
    }
  },

  create(context: RuleContext) {
    function checkPropertyNode(propName: string, node: ESNode) {
      const nodes =
        node.type === 'ArrayExpression' ? node.elements.filter(isDef) : [node]

      for (const prop of nodes) {
        if (!isForbiddenType(prop)) continue

        context.report({
          node: prop,
          messageId: 'propTypeConstructor',
          data: {
            name: propName
          },
          fix: (fixer: any) => {
            if (prop.type === 'Literal' || prop.type === 'TemplateLiteral') {
              const newText = getStringLiteralValue(prop, true)

              if (newText) {
                return fixer.replaceText(prop, newText)
              }
            }
            return null
          }
        })
      }
    }

    function verifyProps(props: ComponentProp[]) {
      for (const prop of props) {
        if (prop.type !== 'object' || prop.propName == null) {
          continue
        }
        if (
          isForbiddenType(prop.value) ||
          prop.value.type === 'ArrayExpression'
        ) {
          checkPropertyNode(prop.propName, prop.value)
        } else if (prop.value.type === 'ObjectExpression') {
          const typeProperty = findProperty(prop.value, 'type')

          if (!typeProperty) continue

          checkPropertyNode(prop.propName, typeProperty.value)
        }
      }
    }

    return compositingVisitors(
      defineScriptSetupVisitor(context, {
        onDefinePropsEnter(_node: any, props: any) {
          verifyProps(props)
        }
      }),
      executeOnVueComponent(context, (obj: any) => {
        verifyProps(getComponentPropsFromOptions(obj))
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
