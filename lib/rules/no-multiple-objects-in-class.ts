/**
 * @author tyankatsu <https://github.com/tyankatsu0105>
 * See LICENSE file in root directory for full license.
 */
import type {
  ArrayExpression,
  RuleContext,
  VDirective,
  VExpressionContainer
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

/**
 * count ObjectExpression element
 */
function countObjectExpression(
  node: VDirective & {
    value: VExpressionContainer & { expression: ArrayExpression }
  }
) {
  return node.value.expression.elements.filter(
    (element: any) => element && element.type === 'ObjectExpression'
  ).length
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow passing multiple objects in an array to class',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-multiple-objects-in-class.html'
    },
    schema: [],
    messages: {
      unexpected: 'Unexpected multiple objects. Merge objects.'
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      'VAttribute[directive=true][key.argument.name="class"][key.name.name="bind"][value.expression.type="ArrayExpression"]'(
        node: VDirective & {
          value: VExpressionContainer & { expression: ArrayExpression }
        }
      ) {
        if (countObjectExpression(node) > 1) {
          context.report({
            node,
            loc: node.loc,
            messageId: 'unexpected'
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
