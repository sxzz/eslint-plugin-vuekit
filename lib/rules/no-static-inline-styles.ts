/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  Property,
  RuleContext,
  VAttribute,
  VDirective
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

/**
 * Checks whether if the given property node is a static value.
 */
function isStaticValue(prop: Property) {
  return (
    !prop.computed &&
    prop.value.type === 'Literal' &&
    (prop.key.type === 'Identifier' || prop.key.type === 'Literal')
  )
}

/**
 * Gets the static properties of a given expression node.
 * - If `SpreadElement` or computed property exists, it gets only the static properties before it.
 *   `:style="{ color: 'red', display: 'flex', ...spread, width: '16px' }"`
 *              ^^^^^^^^^^^^  ^^^^^^^^^^^^^^^
 * - If non-static object exists, it gets only the static properties up to that object.
 *   `:style="[ { color: 'red' }, { display: 'flex', color, width: '16px' }, { height: '16px' } ]"`
 *                ^^^^^^^^^^^^      ^^^^^^^^^^^^^^^         ^^^^^^^^^^^^^
 * - If all properties are static properties, it returns one root node.
 *   `:style="[ { color: 'red' }, { display: 'flex', width: '16px' } ]"`
 *    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 */
function getReportNodes(node: VDirective) {
  const { value } = node
  if (!value) {
    return []
  }
  const { expression } = value
  if (!expression) {
    return []
  }

  let elements
  if (expression.type === 'ObjectExpression') {
    elements = [expression]
  } else if (expression.type === 'ArrayExpression') {
    elements = expression.elements
  } else {
    return []
  }
  const staticProperties = []
  for (const element of elements) {
    if (!element) {
      continue
    }
    if (element.type !== 'ObjectExpression') {
      return staticProperties
    }

    let isAllStatic = true
    for (const prop of element.properties) {
      if (prop.type === 'SpreadElement' || prop.computed) {
        // If `SpreadElement` or computed property exists, it gets only the static properties before it.
        return staticProperties
      }
      if (isStaticValue(prop)) {
        staticProperties.push(prop)
      } else {
        isAllStatic = false
      }
    }
    if (!isAllStatic) {
      // If non-static object exists, it gets only the static properties up to that object.
      return staticProperties
    }
  }
  // If all properties are static properties, it returns one root node.
  return [node]
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow static inline `style` attributes',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-static-inline-styles.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          allowBinding: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      forbiddenStaticInlineStyle: 'Static inline `style` are forbidden.',
      forbiddenStyleAttr: '`style` attributes are forbidden.'
    }
  },

  create(context: RuleContext) {
    /**
     * Reports if the value is static.
     */
    function verifyVBindStyle(node: VDirective) {
      for (const n of getReportNodes(node)) {
        context.report({
          node: n,
          messageId: 'forbiddenStaticInlineStyle'
        })
      }
    }

    const visitor: Record<string, (node: any) => void> = {
      "VAttribute[directive=false][key.name='style']"(node: VAttribute) {
        context.report({
          node,
          messageId: 'forbiddenStyleAttr'
        })
      }
    }
    if (!context.options[0] || !context.options[0].allowBinding) {
      visitor[
        "VAttribute[directive=true][key.name.name='bind'][key.argument.name='style']"
      ] = verifyVBindStyle
    }

    return defineTemplateBodyVisitor(context, visitor)
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
