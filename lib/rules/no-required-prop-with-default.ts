/**
 * @author @neferqiqi
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import * as utils from '../utils/index.ts'

export type ComponentTypeProp = import('../utils').ComponentTypeProp
export type ComponentArrayProp = import('../utils').ComponentArrayProp
export type ComponentObjectProp = import('../utils').ComponentObjectProp
export type ComponentUnknownProp = import('../utils').ComponentUnknownProp
export type ComponentProp = import('../utils').ComponentProp

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce props with default values to be optional',
      categories: ['vue3-recommended'],
      url: 'https://eslint.vuejs.org/rules/no-required-prop-with-default.html'
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          autofix: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      requireOptional: `Prop "{{ key }}" should be optional.`,
      fixRequiredProp: `Change this prop to be optional.`
    }
  },

  create(context: RuleContext) {
    let canAutoFix = false
    const option = context.options[0]
    if (option) {
      canAutoFix = option.autofix
    }

    const handleObjectProp = (
      prop: ComponentProp,
      defaultProps?: Set<string>
    ) => {
      if (
        prop.type === 'object' &&
        prop.propName &&
        prop.value.type === 'ObjectExpression' &&
        (utils.findProperty(prop.value, 'default') ||
          defaultProps?.has(prop.propName))
      ) {
        const requiredProperty = utils.findProperty(prop.value, 'required')
        if (!requiredProperty) return
        const requiredNode = requiredProperty.value
        if (
          requiredNode &&
          requiredNode.type === 'Literal' &&
          Boolean(requiredNode.value)
        ) {
          context.report({
            node: prop.node,
            loc: prop.node.loc,
            data: {
              key: prop.propName
            },
            messageId: 'requireOptional',
            fix: canAutoFix
              ? (fixer: any) => fixer.replaceText(requiredNode, 'false')
              : null,
            suggest: canAutoFix
              ? null
              : [
                  {
                    messageId: 'fixRequiredProp',
                    fix: (fixer: any) =>
                      fixer.replaceText(requiredNode, 'false')
                  }
                ]
          })
        }
      } else if (
        prop.type === 'type' &&
        defaultProps?.has(prop.propName) &&
        prop.required
      ) {
        // skip setter & getter case
        if (
          prop.node.type === 'TSMethodSignature' &&
          (prop.node.kind === 'get' || prop.node.kind === 'set')
        ) {
          return
        }
        // skip computed
        if (prop.node.computed) {
          return
        }
        context.report({
          node: prop.node,
          loc: prop.node.loc,
          data: {
            key: prop.propName
          },
          messageId: 'requireOptional',
          fix: canAutoFix
            ? (fixer: any) => fixer.insertTextAfter(prop.key, '?')
            : null,
          suggest: canAutoFix
            ? null
            : [
                {
                  messageId: 'fixRequiredProp',
                  fix: (fixer: any) => fixer.insertTextAfter(prop.key, '?')
                }
              ]
        })
      }
    }

    return utils.compositingVisitors(
      utils.defineVueVisitor(context, {
        onVueObjectEnter(node: any) {
          for (const prop of utils.getComponentPropsFromOptions(node)) {
            handleObjectProp(prop)
          }
        }
      }),
      utils.defineScriptSetupVisitor(context, {
        onDefinePropsEnter(node: any, props: any) {
          const defaultProps = new Set([
            ...Object.keys(
              utils.getWithDefaultsPropExpressions(context, node).props
            ),
            ...Object.keys(
              utils.getDefaultPropExpressionsForPropsDestructure(node)
            )
          ])
          for (const prop of props) {
            handleObjectProp(prop, defaultProps)
          }
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
