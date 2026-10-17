/**
 * @fileoverview Require default value for props
 * @author Michał Sajnóg <msajnog93@gmail.com> (https://github.com/michalsnik)
 */
import type {
  Expression,
  ObjectExpression,
  RuleContext
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

export type ComponentProp = import('../utils').ComponentProp
export type ComponentObjectProp = import('../utils').ComponentObjectProp
export type ComponentTypeProp = import('../utils').ComponentTypeProp
export type ComponentObjectPropObject = ComponentObjectProp & {
  value: ObjectExpression
}

import * as utils from '../utils/index.ts'

const NATIVE_TYPES = new Set([
  'String',
  'Number',
  'Boolean',
  'Function',
  'Object',
  'Array',
  'Symbol'
])

/**
 * Detects whether given value node is a Boolean type
 */
function isValueNodeOfBooleanType(value: Expression) {
  if (value.type === 'Identifier' && value.name === 'Boolean') {
    return true
  }
  if (value.type === 'ArrayExpression') {
    const elements = value.elements.filter(utils.isDef)
    return (
      elements.length === 1 &&
      elements[0].type === 'Identifier' &&
      elements[0].name === 'Boolean'
    )
  }
  return false
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require default value for props',
      categories: ['vue3-strongly-recommended'],
      url: 'https://eslint.vuejs.org/rules/require-default-prop.html'
    },
    schema: [],
    messages: {
      missingDefault: `Prop '{{propName}}' requires default value to be set.`
    }
  },

  create(context: RuleContext) {
    /**
     * Checks if the passed prop is required
     */
    function propIsRequired(propValue: ObjectExpression) {
      return propValue.properties.some(
        (p: any) =>
          p.type === 'Property' &&
          utils.getStaticPropertyName(p) === 'required' &&
          p.value.type === 'Literal' &&
          p.value.value === true
      )
    }

    /**
     * Checks if the passed prop has a default value
     */
    function propHasDefault(propValue: ObjectExpression) {
      return propValue.properties.some(
        (p: any) =>
          p.type === 'Property' && utils.getStaticPropertyName(p) === 'default'
      )
    }

    /**
     * Checks whether the given props that don't have a default value
     */
    function isWithoutDefaultValue(prop: ComponentObjectProp) {
      switch (prop.value.type) {
        case 'ObjectExpression': {
          return !propIsRequired(prop.value) && !propHasDefault(prop.value)
        }
        case 'Identifier': {
          return NATIVE_TYPES.has(prop.value.name)
        }
        case 'CallExpression':
        case 'MemberExpression': {
          return false
        }
        default: {
          return true
        }
      }
    }

    /**
     * Detects whether given prop node is a Boolean
     */
    function isBooleanProp(prop: ComponentObjectProp) {
      const value = utils.skipTSAsExpression(prop.value)

      return (
        isValueNodeOfBooleanType(value) ||
        (value.type === 'ObjectExpression' &&
          value.properties.some(
            (p: any) =>
              p.type === 'Property' &&
              p.key.type === 'Identifier' &&
              p.key.name === 'type' &&
              isValueNodeOfBooleanType(p.value)
          ))
      )
    }

    function processProps(
      props: ComponentProp[],
      shouldIgnore?: (prop: ComponentObjectProp | ComponentTypeProp) => boolean
    ) {
      for (const prop of props) {
        if (prop.type === 'object') {
          if (
            prop.node.shorthand ||
            !isWithoutDefaultValue(prop) ||
            isBooleanProp(prop) ||
            shouldIgnore?.(prop)
          ) {
            continue
          }
          const propName =
            prop.propName ?? `[${context.sourceCode.getText(prop.node.key)}]`

          context.report({
            node: prop.node,
            messageId: `missingDefault`,
            data: {
              propName
            }
          })
        } else if (prop.type === 'type') {
          if (
            prop.required ||
            (prop.types.length === 1 && prop.types[0] === 'Boolean') ||
            shouldIgnore?.(prop)
          ) {
            continue
          }
          context.report({
            node: prop.node,
            messageId: `missingDefault`,
            data: {
              propName: prop.propName
            }
          })
        }
      }
    }

    return utils.compositingVisitors(
      utils.defineScriptSetupVisitor(context, {
        onDefinePropsEnter(node: any, props: any) {
          const hasWithDefaults = utils.hasWithDefaults(node)
          const defaultsByWithDefaults = utils.getWithDefaultsPropExpressions(
            context,
            node
          )
          const isUsingPropsDestructure = utils.isUsingPropsDestructure(node)
          const defaultsByAssignmentPatterns =
            utils.getDefaultPropExpressionsForPropsDestructure(node)

          processProps(
            props,
            (prop: any) =>
              (prop.type === 'type' &&
                ((!hasWithDefaults && !isUsingPropsDestructure) ||
                  defaultsByWithDefaults.hasUnknown ||
                  Boolean(defaultsByWithDefaults.props[prop.propName]))) ||
              // If using Props Destructure but the property name cannot be determined,
              // it will be ignored.
              (isUsingPropsDestructure &&
                (prop.propName == null ||
                  Boolean(defaultsByAssignmentPatterns[prop.propName])))
          )
        }
      }),
      utils.executeOnVue(context, (obj: any) => {
        processProps(utils.getComponentPropsFromOptions(obj))
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
