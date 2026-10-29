/**
 * @fileoverview Keep order of properties in components
 * @author Michał Sajnóg
 */
import type {
  ASTNode,
  Property,
  RuleContext,
  RuleFixer,
  SpreadElement,
  Token
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  isProperty,
  getStaticPropertyName,
  compositingVisitors,
  executeOnVue,
  defineScriptSetupVisitor
} from '../utils/index.ts'
import { traverseNodes } from '../utils/ast.ts'

export type VisitorKeys = import('eslint-visitor-keys').VisitorKeys

const defaultOrder = [
  // Side Effects (triggers effects outside the component)
  'el',

  // Global Awareness (requires knowledge beyond the component)
  'name',
  'key', // for Nuxt
  'parent',

  // Component Type (changes the type of the component)
  'functional',

  // Template Modifiers (changes the way templates are compiled)
  ['delimiters', 'comments'],

  // Template Dependencies (assets used in the template)
  ['components', 'directives', 'filters'],

  // Composition (merges properties into the options)
  'extends',
  'mixins',
  ['provide', 'inject'],

  // Page Options (component rendered as a router page)
  'ROUTER_GUARDS', // for Vue Router
  'layout', // for Nuxt
  'middleware', // for Nuxt
  'validate', // for Nuxt
  'scrollToTop', // for Nuxt
  'transition', // for Nuxt
  'loading', // for Nuxt

  // Interface (the interface to the component)
  'inheritAttrs',
  'model',
  ['props', 'propsData'],
  'emits', // for Vue.js 3.x
  'slots',
  'expose',

  // Note:
  // The `setup` option is included in the "Composition" category,
  // but the behavior of the `setup` option requires the definition of "Interface",
  // so we prefer to put the `setup` option after the "Interface".
  'setup', // for Vue 3.x

  // Local State (local reactive properties)
  'asyncData', // for Nuxt
  'data',
  'fetch', // for Nuxt
  'head', // for Nuxt
  'computed',

  // Events (callbacks triggered by reactive events)
  'watch',
  'watchQuery', // for Nuxt
  'LIFECYCLE_HOOKS',

  // Non-Reactive Properties (instance properties independent of the reactivity system)
  'methods',

  // Rendering (the declarative description of the component output)
  ['template', 'render'],
  'renderError'
]

const groups: Record<string, string[]> = {
  LIFECYCLE_HOOKS: [
    'beforeCreate',
    'created',
    'beforeMount',
    'mounted',
    'beforeUpdate',
    'updated',
    'activated',
    'deactivated',
    'beforeUnmount', // for Vue.js 3.x
    'unmounted', // for Vue.js 3.x
    'beforeDestroy',
    'destroyed',
    'renderTracked', // for Vue.js 3.x
    'renderTriggered', // for Vue.js 3.x
    'errorCaptured'
  ],
  ROUTER_GUARDS: ['beforeRouteEnter', 'beforeRouteUpdate', 'beforeRouteLeave']
}

function getOrderMap(order: (string | string[])[]) {
  const orderMap = new Map()

  for (const [i, property] of order.entries()) {
    if (Array.isArray(property)) {
      for (const p of property) {
        orderMap.set(p, i)
      }
    } else {
      orderMap.set(property, i)
    }
  }

  return orderMap
}

function isComma(node: Token) {
  return node.type === 'Punctuator' && node.value === ','
}

const ARITHMETIC_OPERATORS = ['+', '-', '*', '/', '%', '**' /* es2016 */]
const BITWISE_OPERATORS = ['&', '|', '^', '~', '<<', '>>', '>>>']
const COMPARISON_OPERATORS = ['==', '!=', '===', '!==', '>', '>=', '<', '<=']
const RELATIONAL_OPERATORS = ['in', 'instanceof']
const ALL_BINARY_OPERATORS = new Set([
  ...ARITHMETIC_OPERATORS,
  ...BITWISE_OPERATORS,
  ...COMPARISON_OPERATORS,
  ...RELATIONAL_OPERATORS
])
const LOGICAL_OPERATORS = new Set(['&&', '||', '??' /* es2020 */])

// Node types that are known to have no side effects.
const NO_SIDE_EFFECT_NODE_TYPES = new Set([
  'FunctionExpression',
  'Identifier',
  'Literal',
  // es2015
  'ArrowFunctionExpression',
  'TemplateElement',
  // typescript
  'TSAsExpression'
])

/**
 * Result `true` if the node is sure that there are no side effects
 *
 * Currently known side effects types
 *
 * node.type === 'CallExpression'
 * node.type === 'NewExpression'
 * node.type === 'UpdateExpression'
 * node.type === 'AssignmentExpression'
 * node.type === 'TaggedTemplateExpression'
 * node.type === 'UnaryExpression' && node.operator === 'delete'
 */
function isNotSideEffectsNode(node: ASTNode, visitorKeys: VisitorKeys) {
  let isValidOrder = true

  let skipNode: ASTNode | null = null
  traverseNodes(node, {
    visitorKeys,

    enterNode(node) {
      if (!isValidOrder || skipNode) {
        return
      }

      if (NO_SIDE_EFFECT_NODE_TYPES.has(node.type)) {
        skipNode = node
      } else if (
        node.type !== 'Property' &&
        node.type !== 'ObjectExpression' &&
        node.type !== 'ArrayExpression' &&
        (node.type !== 'UnaryExpression' ||
          !['!', '~', '+', '-', 'typeof'].includes(node.operator)) &&
        (node.type !== 'BinaryExpression' ||
          !ALL_BINARY_OPERATORS.has(node.operator)) &&
        (node.type !== 'LogicalExpression' ||
          !LOGICAL_OPERATORS.has(node.operator)) &&
        node.type !== 'MemberExpression' &&
        node.type !== 'ConditionalExpression' &&
        // es2015
        node.type !== 'SpreadElement' &&
        node.type !== 'TemplateLiteral' &&
        // es2020
        node.type !== 'ChainExpression'
      ) {
        // Can not be sure that a node has no side effects
        isValidOrder = false
      }
    },

    leaveNode(node) {
      if (skipNode === node) {
        skipNode = null
      }
    }
  })

  return isValidOrder
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce order of properties in components',
      categories: ['vue3-recommended'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/order-in-components.html'
    },
    fixable: 'code', // null or "code" or "whitespace"
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          order: {
            type: 'array',
            items: {
              oneOf: [
                { type: 'string' },
                { type: 'array', items: { type: 'string' } }
              ]
            }
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      order:
        'The "{{name}}" property should be above the "{{firstUnorderedPropertyName}}" property on line {{line}}.',
      reorderWithSideEffects:
        'Manually move "{{name}}" property above "{{firstUnorderedPropertyName}}" property on line {{line}} (might break side effects).'
    }
  },

  create(context: RuleContext) {
    const options = context.options[0] || {}

    const order = options.order || defaultOrder

    const extendedOrder = order.map(
      (property: any) =>
        (typeof property === 'string' && groups[property]) || property
    )
    const orderMap = getOrderMap(extendedOrder)
    const sourceCode = context.sourceCode

    function getOrderPosition(name: string) {
      return orderMap.get(name) ?? -1
    }

    function* handleFix(
      fixer: RuleFixer,
      propertyNode: Property,
      unorderedPropertyNode: Property
    ) {
      const afterComma = sourceCode.getTokenAfter(propertyNode)
      const hasAfterComma = isComma(afterComma)

      const beforeComma = sourceCode.getTokenBefore(propertyNode)
      const codeStart = beforeComma.range[1] // to include comments
      const codeEnd = (hasAfterComma ? afterComma : propertyNode).range[1]

      const removeStart = hasAfterComma ? codeStart : beforeComma.range[0]
      yield fixer.removeRange([removeStart, codeEnd])

      const propertyCode =
        sourceCode.text.slice(codeStart, codeEnd) + (hasAfterComma ? '' : ',')
      const insertTarget = sourceCode.getTokenBefore(unorderedPropertyNode)

      yield fixer.insertTextAfter(insertTarget, propertyCode)
    }

    function checkOrder(propertiesNodes: (Property | SpreadElement)[]) {
      const properties = propertiesNodes
        .filter(isProperty)
        .map((property: any) => ({
          node: property,
          name:
            getStaticPropertyName(property) ||
            (property.key.type === 'Identifier' && property.key.name) ||
            ''
        }))

      for (const [i, property] of properties.entries()) {
        const orderPos = getOrderPosition(property.name)
        if (orderPos < 0) {
          continue
        }
        const propertiesAbove = properties.slice(0, i)
        const unorderedProperties = propertiesAbove
          .filter(
            (p: any) =>
              getOrderPosition(p.name) > getOrderPosition(property.name)
          )
          .sort((p1: any, p2: any) =>
            getOrderPosition(p1.name) > getOrderPosition(p2.name) ? 1 : -1
          )

        const firstUnorderedProperty = unorderedProperties[0]

        if (!firstUnorderedProperty) {
          continue
        }
        const line = firstUnorderedProperty.node.loc.start.line
        const propertyNode = property.node
        const firstUnorderedPropertyNode = firstUnorderedProperty.node
        const hasSideEffectsPossibility = propertiesNodes
          .slice(
            propertiesNodes.indexOf(firstUnorderedPropertyNode),
            propertiesNodes.indexOf(propertyNode) + 1
          )
          .some(
            (property: any) =>
              !isNotSideEffectsNode(property, sourceCode.visitorKeys)
          )

        context.report({
          node: property.node,
          messageId: 'order',
          data: {
            name: property.name,
            firstUnorderedPropertyName: firstUnorderedProperty.name,
            line
          },
          fix: hasSideEffectsPossibility
            ? undefined
            : (fixer: any) =>
                handleFix(fixer, propertyNode, firstUnorderedPropertyNode),
          suggest: hasSideEffectsPossibility
            ? [
                {
                  messageId: 'reorderWithSideEffects',
                  data: {
                    name: property.name,
                    firstUnorderedPropertyName: firstUnorderedProperty.name,
                    line
                  },
                  fix: (fixer: any) =>
                    handleFix(fixer, propertyNode, firstUnorderedPropertyNode)
                }
              ]
            : undefined
        })
      }
    }

    return compositingVisitors(
      executeOnVue(context, (obj: any) => {
        checkOrder(obj.properties)
      }),
      defineScriptSetupVisitor(context, {
        onDefineOptionsEnter(node: any) {
          if (node.arguments.length === 0) return
          const define = node.arguments[0]
          if (define.type !== 'ObjectExpression') return
          checkOrder(define.properties)
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
