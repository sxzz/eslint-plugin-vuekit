import type { RuleContext, VDirective } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { defineTemplateBodyVisitor, hasDirective } from '../utils/index.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'disallow using `v-else-if`/`v-else` on the same element as `v-for`',
      categories: null,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-use-v-else-with-v-for.html'
    },
    schema: [],
    messages: {
      unexpectedDirectiveWithVFor:
        'Unexpected `{{ directiveName }}` and `v-for` on the same element. Move `{{ directiveName }}` to a wrapper element instead.'
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='for']"(node: VDirective) {
        const element = node.parent.parent

        if (hasDirective(element, 'else-if')) {
          context.report({
            node: element,
            messageId: 'unexpectedDirectiveWithVFor',
            data: { directiveName: 'v-else-if' }
          })
        } else if (hasDirective(element, 'else')) {
          context.report({
            node: element,
            messageId: 'unexpectedDirectiveWithVFor',
            data: { directiveName: 'v-else' }
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
