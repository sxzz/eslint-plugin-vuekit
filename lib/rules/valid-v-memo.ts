/**
 * @author Yosuke Ota <https://github.com/ota-meshi>
 * See LICENSE file in root directory for full license.
 */
import type {
  RuleContext,
  VDirective,
  VElement,
  VExpressionContainer
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  defineTemplateBodyVisitor,
  hasDirective,
  isEmptyValueDirective
} from '../utils/index.ts'

function verifyMemoExpression(
  context: RuleContext,
  expression: NonNullable<VExpressionContainer['expression']>,
  expressions: NonNullable<VExpressionContainer['expression']>[]
) {
  switch (expression.type) {
    case 'ObjectExpression':
    case 'ClassExpression':
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
    case 'Literal':
    case 'TemplateLiteral':
    case 'UnaryExpression':
    case 'BinaryExpression':
    case 'UpdateExpression': {
      context.report({
        node: expression,
        messageId: 'expectedArray'
      })
      break
    }
    case 'AssignmentExpression': {
      expressions.push(expression.right)
      break
    }
    case 'TSAsExpression': {
      expressions.push(expression.expression)
      break
    }
    case 'SequenceExpression': {
      const lastExpression = expression.expressions.at(-1)
      if (lastExpression) {
        expressions.push(lastExpression)
      }
      break
    }
    case 'ConditionalExpression': {
      expressions.push(expression.consequent, expression.alternate)
      break
    }
  }
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce valid `v-memo` directives',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/valid-v-memo.html'
    },
    schema: [],
    messages: {
      unexpectedArgument: "'v-memo' directives require no argument.",
      unexpectedModifier: "'v-memo' directives require no modifier.",
      expectedValue: "'v-memo' directives require that attribute value.",
      expectedArray:
        "'v-memo' directives require the attribute value to be an array.",
      insideVFor: "'v-memo' directive does not work inside 'v-for'."
    }
  },

  create(context: RuleContext) {
    let vForElement: VElement | null = null
    return defineTemplateBodyVisitor(context, {
      VElement(node: any) {
        if (!vForElement && hasDirective(node, 'for')) {
          vForElement = node
        }
      },
      'VElement:exit'(node: any) {
        if (vForElement === node) {
          vForElement = null
        }
      },

      "VAttribute[directive=true][key.name.name='memo']"(node: VDirective) {
        if (vForElement && vForElement !== node.parent.parent) {
          context.report({
            node: node.key,
            messageId: 'insideVFor'
          })
        }
        if (node.key.argument) {
          context.report({
            node: node.key.argument,
            messageId: 'unexpectedArgument'
          })
        }
        const lastModifier = node.key.modifiers.at(-1)
        if (lastModifier) {
          context.report({
            node,
            loc: {
              start: node.key.modifiers[0].loc.start,
              end: lastModifier.loc.end
            },
            messageId: 'unexpectedModifier'
          })
        }
        if (!node.value || isEmptyValueDirective(node, context)) {
          context.report({
            node,
            messageId: 'expectedValue'
          })
          return
        }
        if (!node.value.expression) {
          return
        }
        const expressions = [node.value.expression]
        let expression
        while ((expression = expressions.pop())) {
          verifyMemoExpression(context, expression, expressions)
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
