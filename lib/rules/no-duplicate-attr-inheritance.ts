/**
 * @fileoverview Disable inheritAttrs when using v-bind="$attrs"
 * @author Hiroki Osame
 */
import type {
  ObjectExpression,
  RuleContext,
  VElement,
  VExpressionContainer,
  VReference
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  hasDirective,
  findProperty,
  compositingVisitors,
  executeOnVue,
  defineScriptSetupVisitor,
  defineTemplateBodyVisitor,
  isVElement
} from '../utils/index.ts'

function isConditionalGroup(elements: VElement[]) {
  const firstElement = elements[0]
  const lastElement = elements.at(-1)

  if (!lastElement || elements.length < 2) {
    return false
  }

  const inBetweenElements = elements.slice(1, -1)

  return (
    hasDirective(firstElement, 'if') &&
    (hasDirective(lastElement, 'else-if') ||
      hasDirective(lastElement, 'else')) &&
    inBetweenElements.every((element: any) => hasDirective(element, 'else-if'))
  )
}

function isMultiRootNodes(elements: VElement[]) {
  return elements.length > 1 && !isConditionalGroup(elements)
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'enforce `inheritAttrs` to be set to `false` when using `v-bind="$attrs"`',
      categories: undefined,
      url: 'https://eslint.vuejs.org/rules/no-duplicate-attr-inheritance.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          checkMultiRootNodes: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      noDuplicateAttrInheritance: 'Set "inheritAttrs" to false.'
    }
  },

  create(context: RuleContext) {
    const options = context.options[0] || {}
    const shouldCheckMultiRootNodes = options.checkMultiRootNodes === true

    let shouldInheritAttrs = true

    const attrsRefs: VReference[] = []

    function processOptions(node: ObjectExpression) {
      const inheritAttrsProp = findProperty(node, 'inheritAttrs')

      if (inheritAttrsProp && inheritAttrsProp.value.type === 'Literal') {
        shouldInheritAttrs = Boolean(inheritAttrsProp.value.value)
      }
    }

    return compositingVisitors(
      executeOnVue(context, processOptions),
      defineScriptSetupVisitor(context, {
        onDefineOptionsEnter(node: any) {
          if (node.arguments.length === 0) return
          const define = node.arguments[0]
          if (define.type !== 'ObjectExpression') return
          processOptions(define)
        }
      }),
      defineTemplateBodyVisitor(context, {
        "VAttribute[directive=true][key.name.name='bind'][key.argument=null] > VExpressionContainer"(
          node: VExpressionContainer
        ) {
          if (!shouldInheritAttrs) {
            return
          }
          const reference = node.references.find(
            (reference: any) =>
              reference.variable == null && reference.id.name === '$attrs'
          )

          if (reference) {
            attrsRefs.push(reference)
          }
        }
      }),
      {
        'Program:exit'(program: any) {
          const element = program.templateBody
          if (element == null) {
            return
          }

          const rootElements = element.children.filter(isVElement)

          if (!shouldCheckMultiRootNodes && isMultiRootNodes(rootElements))
            return

          for (const attrsRef of attrsRefs) {
            context.report({
              node: attrsRef.id,
              messageId: 'noDuplicateAttrInheritance'
            })
          }
        }
      }
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
