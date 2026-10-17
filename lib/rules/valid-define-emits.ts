/**
 * @author Yosuke Ota <https://github.com/ota-meshi>
 * See LICENSE file in root directory for full license.
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule
} from '../types/rule.ts'

import type { CallExpression, Expression, RuleContext } from '../types/index.ts'

import { findVariable } from '@eslint-community/eslint-utils'
import {
  getScriptSetupElement,
  compositingVisitors,
  defineScriptSetupVisitor,
  inRange,
  getScope,
  withinTypeNode,
  defineVueVisitor,
  findProperty
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid `defineEmits` compiler macro',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/valid-define-emits.html'
    },
    schema: [],
    messages: {
      hasTypeAndArg: '`defineEmits` has both a type-only emit and an argument.',
      referencingLocally:
        '`defineEmits` is referencing locally declared variables.',
      multiple: '`defineEmits` has been called multiple times.',
      notDefined: 'Custom events are not defined.',
      definedInBoth:
        'Custom events are defined in both `defineEmits` and `export default {}`.'
    }
  },

  create(context: RuleContext) {
    const scriptSetup = getScriptSetupElement(context)
    if (!scriptSetup) {
      return {}
    }

    const emitsDefExpressions = new Set<Expression>()
    let hasDefaultExport = false

    const defineEmitsNodes: CallExpression[] = []

    let emptyDefineEmits: CallExpression | null = null

    return compositingVisitors(
      defineScriptSetupVisitor(context, {
        onDefineEmitsEnter(node: any) {
          defineEmitsNodes.push(node)

          const typeArguments =
            'typeArguments' in node ? node.typeArguments : node.typeParameters
          if (node.arguments.length > 0) {
            if (typeArguments && typeArguments.params.length > 0) {
              // `defineEmits` has both a literal type and an argument.
              context.report({
                node,
                messageId: 'hasTypeAndArg'
              })
              return
            }

            emitsDefExpressions.add(node.arguments[0])
          } else {
            if (!typeArguments || typeArguments.params.length === 0) {
              emptyDefineEmits = node
            }
          }
        },
        Identifier(node: any) {
          for (const defineEmits of emitsDefExpressions) {
            if (!inRange(defineEmits.range, node)) {
              continue
            }

            const variable = (
              findVariable as unknown as WithVue<typeof findVariable>
            )(getScope(context, node), node)
            if (!(
              variable &&
              variable.references.some((ref) => ref.identifier === node) &&
              variable.defs.length > 0 &&
              variable.defs.every(
                (def) =>
                  def.type !== 'ImportBinding' &&
                  inRange(scriptSetup.range, def.name) &&
                  !inRange(defineEmits.range, def.name)
              )
            )) {
              continue
            }

            if (withinTypeNode(node)) {
              continue
            }
            //`defineEmits` is referencing locally declared variables.
            context.report({
              node,
              messageId: 'referencingLocally'
            })
          }
        }
      }),
      defineVueVisitor(context, {
        onVueObjectEnter(node: any, { type }: any) {
          if (type !== 'export' || inRange(scriptSetup.range, node)) {
            return
          }

          hasDefaultExport = Boolean(findProperty(node, 'emits'))
        }
      }),
      {
        'Program:exit'() {
          if (defineEmitsNodes.length === 0) {
            return
          }
          if (defineEmitsNodes.length > 1) {
            // `defineEmits` has been called multiple times.
            for (const node of defineEmitsNodes) {
              context.report({
                node,
                messageId: 'multiple'
              })
            }
            return
          }
          if (emptyDefineEmits) {
            if (!hasDefaultExport) {
              // Custom events are not defined.
              context.report({
                node: emptyDefineEmits,
                messageId: 'notDefined'
              })
            }
          } else {
            if (hasDefaultExport) {
              // Custom events are defined in both `defineEmits` and `export default {}`.
              for (const node of defineEmitsNodes) {
                context.report({
                  node,
                  messageId: 'definedInBoth'
                })
              }
            }
          }
        }
      }
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
