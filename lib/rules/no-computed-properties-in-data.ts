/**
 * @author  Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  ArrowFunctionExpression,
  FunctionDeclaration,
  FunctionExpression,
  MemberExpression,
  RuleContext
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  compositingVisitors,
  defineVueVisitor,
  findProperty,
  iterateProperties,
  isThis,
  getStaticPropertyName
} from '../utils/index.ts'

export type VueObjectData = import('../utils').VueObjectData

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow accessing computed properties in `data`',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-computed-properties-in-data.html'
    },
    schema: [],
    messages: {
      cannotBeUsed:
        'The computed property cannot be used in `data()` because it is before initialization.'
    }
  },

  create(context: RuleContext) {
    const contextMap = new Map()
    type ScopeStack = {
      upper: ScopeStack | null
      node: FunctionExpression | FunctionDeclaration | ArrowFunctionExpression
    }

    let scopeStack: ScopeStack | null = null

    return compositingVisitors(
      {
        ':function'(
          node:
            FunctionExpression | FunctionDeclaration | ArrowFunctionExpression
        ) {
          scopeStack = {
            upper: scopeStack,
            node
          }
        },
        ':function:exit'() {
          scopeStack &&= scopeStack.upper
        }
      },
      defineVueVisitor(context, {
        onVueObjectEnter(node: any) {
          const dataProperty = findProperty(node, 'data')
          if (
            !dataProperty ||
            (dataProperty.value.type !== 'FunctionExpression' &&
              dataProperty.value.type !== 'ArrowFunctionExpression')
          ) {
            return
          }
          const computedNames = new Set()
          const computedProperties = iterateProperties(
            node,
            new Set(['computed'])
          )
          for (const computed of computedProperties) {
            computedNames.add(computed.name)
          }

          contextMap.set(node, { data: dataProperty.value, computedNames })
        },

        MemberExpression(node: MemberExpression, vueData: VueObjectData) {
          if (!scopeStack || !isThis(node.object, context)) {
            return
          }
          const ctx = contextMap.get(vueData.node)
          if (!ctx || ctx.data !== scopeStack.node) {
            return
          }
          const name = getStaticPropertyName(node)
          if (!name || !ctx.computedNames.has(name)) {
            return
          }
          context.report({
            node,
            messageId: 'cannotBeUsed'
          })
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
