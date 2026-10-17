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
      description: 'enforce valid `defineProps` compiler macro',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/valid-define-props.html'
    },
    schema: [],
    messages: {
      hasTypeAndArg:
        '`defineProps` has both a type-only props and an argument.',
      referencingLocally:
        '`defineProps` is referencing locally declared variables.',
      multiple: '`defineProps` has been called multiple times.',
      notDefined: 'Props are not defined.',
      definedInBoth:
        'Props are defined in both `defineProps` and `export default {}`.'
    }
  },

  create(context: RuleContext) {
    const scriptSetup = getScriptSetupElement(context)
    if (!scriptSetup) {
      return {}
    }

    const propsDefExpressions = new Set<Expression>()
    let hasDefaultExport = false

    const definePropsNodes: CallExpression[] = []

    let emptyDefineProps: CallExpression | null = null

    return compositingVisitors(
      defineScriptSetupVisitor(context, {
        onDefinePropsEnter(node: any) {
          definePropsNodes.push(node)

          const typeArguments =
            'typeArguments' in node ? node.typeArguments : node.typeParameters
          if (node.arguments.length > 0) {
            if (typeArguments && typeArguments.params.length > 0) {
              // `defineProps` has both a literal type and an argument.
              context.report({
                node,
                messageId: 'hasTypeAndArg'
              })
              return
            }

            propsDefExpressions.add(node.arguments[0])
          } else {
            if (!typeArguments || typeArguments.params.length === 0) {
              emptyDefineProps = node
            }
          }
        },
        Identifier(node: any) {
          for (const defineProps of propsDefExpressions) {
            if (!inRange(defineProps.range, node)) {
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
                  !inRange(defineProps.range, def.name)
              )
            )) {
              continue
            }

            if (withinTypeNode(node)) {
              continue
            }
            //`defineProps` is referencing locally declared variables.
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

          hasDefaultExport = Boolean(findProperty(node, 'props'))
        }
      }),
      {
        'Program:exit'() {
          if (definePropsNodes.length === 0) {
            return
          }
          if (definePropsNodes.length > 1) {
            // `defineProps` has been called multiple times.
            for (const node of definePropsNodes) {
              context.report({
                node,
                messageId: 'multiple'
              })
            }
            return
          }
          if (emptyDefineProps) {
            if (!hasDefaultExport) {
              // Props are not defined.
              context.report({
                node: emptyDefineProps,
                messageId: 'notDefined'
              })
            }
          } else {
            if (hasDefaultExport) {
              // Props are defined in both `defineProps` and `export default {}`.
              for (const node of definePropsNodes) {
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
