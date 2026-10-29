/**
 * @author Yosuke Ota
 * This rule is based on X_V_FOR_TEMPLATE_KEY_PLACEMENT error of Vue 3.
 * see https://github.com/vuejs/vue-next/blob/b0d01e9db9ffe5781cce5a2d62c8552db3d615b0/packages/compiler-core/src/errors.ts#L70
 */
import type { RuleContext, VDirective } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  defineTemplateBodyVisitor,
  getDirective,
  isVElement,
  hasDirective
} from '../utils/index.ts'

/**
 * Check whether the given attribute is using the variables which are defined by `v-for` directives.
 */
function isUsingIterationVar(vFor: VDirective, vBindKey: VDirective) {
  if (vBindKey.value == null) {
    return false
  }
  const references = vBindKey.value.references
  const variables = vFor.parent.parent.variables
  return references.some((reference: any) =>
    variables.some(
      (variable: any) =>
        variable.id.name === reference.id.name && variable.kind === 'v-for'
    )
  )
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow key of `<template v-for>` placed on child elements',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-v-for-template-key-on-child.html'
    },
    schema: [],
    messages: {
      vForTemplateKeyPlacement:
        '`<template v-for>` key should be placed on the `<template>` tag.'
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VElement[name='template'] > VStartTag > VAttribute[directive=true][key.name.name='for']"(
        node: VDirective
      ) {
        const template = node.parent.parent
        const vBindKeyOnTemplate = getDirective(template, 'bind', 'key')
        if (
          vBindKeyOnTemplate &&
          isUsingIterationVar(node, vBindKeyOnTemplate)
        ) {
          return
        }

        for (const child of template.children) {
          if (
            !isVElement(child) ||
            hasDirective(child, 'if') ||
            hasDirective(child, 'else-if') ||
            hasDirective(child, 'else') ||
            hasDirective(child, 'for')
          ) {
            continue
          }
          const vBindKeyOnChild = getDirective(child, 'bind', 'key')
          if (vBindKeyOnChild && isUsingIterationVar(node, vBindKeyOnChild)) {
            context.report({
              node: vBindKeyOnChild,
              loc: vBindKeyOnChild.loc,
              messageId: 'vForTemplateKeyPlacement'
            })
          }
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
