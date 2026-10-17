/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, VElement } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  defineTemplateBodyVisitor,
  getAttribute,
  getDirective,
  hasDirective
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow `key` attribute on `<template>`',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/no-template-key.html'
    },
    schema: [],
    messages: {
      disallow:
        "'<template>' cannot be keyed. Place the key on real elements instead."
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VElement[name='template']"(node: VElement) {
        const keyNode =
          getAttribute(node, 'key') || getDirective(node, 'bind', 'key')
        if (!keyNode || hasDirective(node, 'for')) {
          // v-for on template is valid for Vue.js 3.x.
          // <template v-for="item in list" :key="item.id"> ... </template>
          // see https://github.com/vuejs/vue-next/issues/1734
          return
        }
        context.report({
          node: keyNode,
          loc: keyNode.loc,
          messageId: 'disallow'
        })
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
