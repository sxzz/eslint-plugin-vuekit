/**
 * @author Mussin Benarbia
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VElement } from '../types/index.ts'
import type { Normalize } from '../types/ast.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  isVElement,
  hasAttribute,
  compositingVisitors,
  defineScriptSetupVisitor,
  executeOnVue,
  findProperty,
  defineTemplateBodyVisitor,
  isStringLiteral,
  getStringLiteralValue
} from '../utils/index.ts'

export type TypeNode = Normalize<
  import('@typescript-eslint/types').TSESTree.TypeNode
>
export type TypeElement = Normalize<
  import('@typescript-eslint/types').TSESTree.TypeElement
>

function getSlotsName(node: TypeElement) {
  if (
    node.type !== 'TSMethodSignature' &&
    node.type !== 'TSPropertySignature'
  ) {
    return null
  }

  const key = node.key
  if (key.type === 'Literal') {
    return typeof key.value === 'string' ? key.value : null
  }

  return key.type === 'Identifier' ? key.name : null
}

function getSlotNameNode(node: VElement) {
  return node.startTag.attributes.find(
    (node: any) =>
      (!node.directive && node.key.name === 'name') ||
      (node.directive &&
        node.key.name.name === 'bind' &&
        node.key.argument?.type === 'VIdentifier' &&
        node.key.argument?.name === 'name')
  )
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'require slots to be explicitly defined',
      categories: undefined,
      url: 'https://eslint.vuejs.org/rules/require-explicit-slots.html'
    },
    schema: [],
    messages: {
      requireExplicitSlots: 'Slots must be explicitly defined.',
      alreadyDefinedSlot: 'Slot {{slotName}} is already defined.'
    }
  },

  create(context: RuleContext) {
    const sourceCode = context.sourceCode
    const documentFragment =
      sourceCode.parserServices.getDocumentFragment &&
      sourceCode.parserServices.getDocumentFragment()
    if (!documentFragment) {
      return {}
    }
    const scripts = documentFragment.children.filter(
      (element: any) => isVElement(element) && element.name === 'script'
    )
    if (scripts.every((script: any) => !hasAttribute(script, 'lang', 'ts'))) {
      return {}
    }
    const slotsDefined = new Set()

    function reportMissingSlot(node: VElement, slotName: string | undefined) {
      if (!slotsDefined.has(slotName)) {
        context.report({
          node,
          messageId: 'requireExplicitSlots'
        })
      }
    }

    return compositingVisitors(
      defineScriptSetupVisitor(context, {
        onDefineSlotsEnter(_node: any, slots: any) {
          for (const slot of slots) {
            if (!slot.slotName) {
              continue
            }

            if (slotsDefined.has(slot.slotName)) {
              context.report({
                node: slot.node,
                messageId: 'alreadyDefinedSlot',
                data: {
                  slotName: slot.slotName
                }
              })
            } else {
              slotsDefined.add(slot.slotName)
            }
          }
        }
      }),
      executeOnVue(context, (obj: any) => {
        const slotsProperty = findProperty(obj, 'slots')
        if (!slotsProperty) return

        const slotsTypeHelper =
          slotsProperty.value.type === 'TSAsExpression' &&
          slotsProperty.value.typeAnnotation.type === 'TSTypeReference' &&
          slotsProperty.value.typeAnnotation.typeName.type === 'Identifier' &&
          slotsProperty.value.typeAnnotation.typeName.name === 'SlotsType' &&
          slotsProperty.value.typeAnnotation
        if (!slotsTypeHelper) return

        const typeArguments = slotsTypeHelper.typeArguments
        const param = typeArguments?.params[0]
        if (!param) return

        if (param.type === 'TSTypeLiteral') {
          for (const memberNode of param.members) {
            const slotName = getSlotsName(memberNode)
            if (!slotName) continue

            if (slotsDefined.has(slotName)) {
              context.report({
                node: memberNode,
                messageId: 'alreadyDefinedSlot',
                data: {
                  slotName
                }
              })
            } else {
              slotsDefined.add(slotName)
            }
          }
        }
      }),
      defineTemplateBodyVisitor(context, {
        "VElement[name='slot']"(node: VElement) {
          const nameNode = getSlotNameNode(node)

          // if no slot name is declared, default to 'default'
          if (!nameNode) {
            reportMissingSlot(node, 'default')
            return
          }

          if (nameNode.directive) {
            const expression = nameNode.value?.expression
            // ignore attribute binding except string literal
            if (!expression || !isStringLiteral(expression)) {
              return
            }

            const name = getStringLiteralValue(expression) || undefined
            reportMissingSlot(node, name)
          } else {
            reportMissingSlot(node, nameNode.value?.value)
          }
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
