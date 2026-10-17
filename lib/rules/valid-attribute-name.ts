/**
 * @author Doug Wade <douglas.b.wade@gmail.com>
 * See LICENSE file in root directory for full license.
 */
import type {
  RuleContext,
  VAttribute,
  VDirective,
  VIdentifier
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor, isCustomComponent } from '../utils/index.ts'
import xnv from 'xml-name-validator'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'require valid attribute names',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/valid-attribute-name.html'
    },
    schema: [],
    messages: {
      attribute: 'Attribute name {{name}} is not valid.'
    }
  },

  create(context: RuleContext) {
    const getName = (key: string | VIdentifier) =>
      typeof key === 'string' ? key : key.name

    return defineTemplateBodyVisitor(context, {
      VAttribute(node: VDirective | VAttribute) {
        if (isCustomComponent(node.parent.parent)) {
          return
        }

        const name = getName(node.key.name)

        if (
          name === 'bind' &&
          node.directive &&
          node.key.argument &&
          node.key.argument.type === 'VIdentifier' &&
          !xnv.name(node.key.argument.name)
        ) {
          context.report({
            node,
            messageId: 'attribute',
            data: {
              name: node.key.argument.name
            }
          })
        }

        if (!node.directive && !xnv.name(name)) {
          context.report({
            node,
            messageId: 'attribute',
            data: {
              name
            }
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
