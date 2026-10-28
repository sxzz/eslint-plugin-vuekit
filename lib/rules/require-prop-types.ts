/**
 * @fileoverview Prop definitions should be detailed
 * @author Armano
 */
import type {
  Expression,
  ObjectExpression,
  RuleContext
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  findProperty,
  compositingVisitors,
  defineScriptSetupVisitor,
  executeOnVue,
  getComponentPropsFromOptions
} from '../utils/index.ts'

export type ComponentProp = import('../utils').ComponentProp

function objectHasType(node: ObjectExpression) {
  const typeProperty = findProperty(
    node,
    'type',
    (p) => p.value.type !== 'ArrayExpression' || p.value.elements.length > 0
  )
  const validatorProperty = findProperty(node, 'validator')
  return Boolean(typeProperty || validatorProperty)
}

function optionHasType(node: Expression) {
  switch (node.type) {
    case 'ObjectExpression': {
      // foo: {
      return objectHasType(node)
    }
    case 'ArrayExpression': {
      // foo: [
      return node.elements.length > 0
    }
    case 'FunctionExpression':
    case 'ArrowFunctionExpression': {
      return false
    }
  }

  // Unknown
  return null
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require type definitions in props',
      categories: ['vue3-strongly-recommended'],
      url: 'https://eslint.vuejs.org/rules/require-prop-types.html'
    },
    schema: [],
    messages: {
      requireType: 'Prop "{{name}}" should define at least its type.'
    }
  },

  create(context: RuleContext) {
    function checkProperty(prop: ComponentProp) {
      if (prop.type !== 'object' && prop.type !== 'array') {
        return
      }
      const hasType =
        prop.type !== 'array' && (optionHasType(prop.value) ?? true)

      if (hasType) {
        return
      }

      const { node, propName } = prop
      const name =
        propName || (node.type === 'Identifier' && node.name) || 'Unknown prop'
      context.report({
        node,
        messageId: 'requireType',
        data: {
          name
        }
      })
    }

    return compositingVisitors(
      defineScriptSetupVisitor(context, {
        onDefinePropsEnter(_node: any, props: any) {
          for (const prop of props) {
            checkProperty(prop)
          }
        },
        onDefineModelEnter(node: any, model: any) {
          if (
            model.typeNode ||
            (model.options && (optionHasType(model.options) ?? true))
          ) {
            return
          }
          context.report({
            node: model.options || node,
            messageId: 'requireType',
            data: {
              name: model.name.modelName
            }
          })
        }
      }),
      executeOnVue(context, (obj: any) => {
        const props = getComponentPropsFromOptions(obj)

        for (const prop of props) {
          checkProperty(prop)
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
