/**
 * @fileoverview Enforces that a return statement is present in computed property (return-in-computed-property)
 * @author Armano
 */
import type {
  ArrowFunctionExpression,
  FunctionExpression,
  Program,
  RuleContext
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { ReferenceTracker } from '@eslint-community/eslint-utils'
import {
  getScope,
  iterateReferencesTraceMap,
  getGetterBodyFromComputedFunction,
  defineVueVisitor,
  getComputedProperties,
  executeOnFunctionsWithoutReturn
} from '../utils/index.ts'

export type ComponentComputedProperty =
  import('../utils').ComponentComputedProperty

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'enforce that a return statement is present in computed property',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/return-in-computed-property.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          treatUndefinedAsUnspecified: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      expectedReturnInFunction:
        'Expected to return a value in computed function.',
      expectedReturnInProperty:
        'Expected to return a value in "{{name}}" computed property.'
    }
  },

  create(context: RuleContext) {
    const options = context.options[0] || {}
    const shouldTreatUndefinedAsUnspecified =
      options.treatUndefinedAsUnspecified !== false

    const computedProperties = new Set<ComponentComputedProperty>()

    const computedFunctionNodes: (
      FunctionExpression | ArrowFunctionExpression
    )[] = []

    return Object.assign(
      {
        Program(program: Program) {
          const tracker = new ReferenceTracker(
            getScope(context, program) as unknown as ConstructorParameters<
              typeof ReferenceTracker
            >[0]
          )
          const map = {
            computed: {
              [ReferenceTracker.CALL]: true
            }
          }

          for (const { node } of iterateReferencesTraceMap(tracker, map)) {
            if (node.type !== 'CallExpression') {
              continue
            }

            const getter = getGetterBodyFromComputedFunction(node)
            if (getter) {
              computedFunctionNodes.push(getter)
            }
          }
        }
      },
      defineVueVisitor(context, {
        onVueObjectEnter(obj: any) {
          for (const computedProperty of getComputedProperties(obj)) {
            computedProperties.add(computedProperty)
          }
        }
      }),
      executeOnFunctionsWithoutReturn(
        context,
        shouldTreatUndefinedAsUnspecified,
        (node: any) => {
          for (const cp of computedProperties) {
            if (cp.value && cp.value.parent === node) {
              context.report({
                node,
                messageId: 'expectedReturnInProperty',
                data: {
                  name: cp.key || 'Unknown'
                }
              })
            }
          }
          for (const cf of computedFunctionNodes) {
            if (cf === node) {
              context.report({
                node,
                messageId: 'expectedReturnInFunction'
              })
            }
          }
        }
      )
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
