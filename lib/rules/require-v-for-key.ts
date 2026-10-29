/**
 * @author Toru Nagashima
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VDirective, VElement } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  hasDirective,
  isCustomComponent,
  defineTemplateBodyVisitor
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'require `v-bind:key` with `v-for` directives',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/require-v-for-key.html'
    },
    schema: [],
    messages: {
      requireKey:
        "Elements in iteration expect to have 'v-bind:key' directives."
    }
  },

  create(context: RuleContext) {
    /**
     * Check the given element about `v-bind:key` attributes.
     */
    function checkKey(element: VElement) {
      if (hasDirective(element, 'bind', 'key')) {
        return
      }
      if (element.name === 'template' || element.name === 'slot') {
        for (const child of element.children) {
          if (child.type === 'VElement') {
            checkKey(child)
          }
        }
      } else if (!isCustomComponent(element)) {
        context.report({
          node: element.startTag,
          loc: element.startTag.loc,
          messageId: 'requireKey'
        })
      }
    }

    return defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='for']"(node: VDirective) {
        checkKey(node.parent.parent)
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
