/**
 * @fileoverview Report used components
 * @author Michał Sajnóg
 */
import type {
  Position,
  Property,
  RuleContext,
  VAttribute,
  VDirective,
  VElement
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import {
  defineTemplateBodyVisitor,
  isHtmlElementNode,
  isSvgElementNode,
  isMathElementNode,
  isHtmlWellKnownElementName,
  isSvgWellKnownElementName,
  isMathWellKnownElementName,
  hasAttribute,
  executeOnVue,
  getRegisteredComponents
} from '../utils/index.ts'
import {
  isPascalCase,
  isCamelCase,
  pascalCase,
  camelCase
} from '../utils/casing.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'disallow registering components that are not used inside templates',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/no-unused-components.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          ignoreWhenBindingPresent: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      unused: 'The "{{name}}" component has been registered but not used.'
    }
  },
  create(context: RuleContext) {
    const options = context.options[0] || {}
    const ignoreWhenBindingPresent =
      options.ignoreWhenBindingPresent === undefined
        ? true
        : options.ignoreWhenBindingPresent
    const usedComponents = new Set<string>()
    let registeredComponents: { node: Property; name: string }[] = []
    let shouldIgnoreReporting = false
    let templateLocation: Position

    return defineTemplateBodyVisitor(
      context,
      {
        VElement(node) {
          if (
            (!isHtmlElementNode(node) &&
              !isSvgElementNode(node) &&
              !isMathElementNode(node)) ||
            isHtmlWellKnownElementName(node.rawName) ||
            isSvgWellKnownElementName(node.rawName) ||
            isMathWellKnownElementName(node.rawName)
          ) {
            return
          }

          usedComponents.add(node.rawName)
        },
        "VAttribute[directive=true][key.name.name='bind'][key.argument.name='is'], VAttribute[directive=true][key.name.name='is']"(
          node: VDirective
        ) {
          if (
            !node.value || // `<component :is>`
            node.value.type !== 'VExpressionContainer' ||
            !node.value.expression // `<component :is="">`
          )
            return

          if (node.value.expression.type === 'Literal') {
            usedComponents.add(node.value.expression.value as string)
          } else if (ignoreWhenBindingPresent) {
            shouldIgnoreReporting = true
          }
        },
        "VAttribute[directive=false][key.name='is']"(node: VAttribute) {
          if (!node.value) {
            return
          }
          const value = node.value.value.startsWith('vue:') // Usage on native elements 3.1+
            ? node.value.value.slice(4)
            : node.value.value
          usedComponents.add(value)
        },
        "VElement[name='template']"(node: VElement) {
          templateLocation ||= node.loc.start
        },
        "VElement[name='template']:exit"(node: VElement) {
          if (
            shouldIgnoreReporting ||
            node.loc.start !== templateLocation ||
            hasAttribute(node, 'src')
          )
            return

          for (const { node, name } of registeredComponents) {
            // If the component name is PascalCase or camelCase
            // it can be used in various of ways inside template,
            // like "theComponent", "The-component" etc.
            // but except snake_case
            if (isPascalCase(name) || isCamelCase(name)) {
              if (
                [...usedComponents].some(
                  (n) =>
                    !n.includes('_') &&
                    (name === pascalCase(n) || name === camelCase(n))
                )
              ) {
                continue
              }
            } else {
              // In any other case the used component name must exactly match
              // the registered name
              if (usedComponents.has(name)) {
                continue
              }
            }

            context.report({
              node,
              messageId: 'unused',
              data: {
                name
              }
            })
          }
        }
      },
      executeOnVue(context, (obj) => {
        registeredComponents = getRegisteredComponents(obj)
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
