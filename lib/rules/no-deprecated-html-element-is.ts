/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  RuleContext,
  VAttribute,
  VDirective,
  VElement
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import * as utils from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow using deprecated the `is` attribute on HTML elements (in Vue.js 3.0.0+)',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-html-element-is.html'
    },
    schema: [],
    messages: {
      unexpected: 'The `is` attribute on HTML element are deprecated.'
    }
  },
  create(context: RuleContext) {
    function isValidElement(node: VElement) {
      return (
        !utils.isHtmlWellKnownElementName(node.rawName) &&
        !utils.isSvgWellKnownElementName(node.rawName) &&
        !utils.isMathWellKnownElementName(node.rawName)
      )
    }
    return utils.defineTemplateBodyVisitor(context, {
      "VAttribute[directive=true][key.name.name='bind'][key.argument.name='is']"(
        node: VDirective
      ) {
        if (isValidElement(node.parent.parent)) {
          return
        }
        context.report({
          node,
          loc: node.loc,
          messageId: 'unexpected'
        })
      },
      "VAttribute[directive=false][key.name='is']"(node: VAttribute) {
        if (isValidElement(node.parent.parent)) {
          return
        }
        if (node.value && node.value.value.startsWith('vue:')) {
          // Usage on native elements 3.1+
          return
        }
        context.report({
          node,
          loc: node.loc,
          messageId: 'unexpected'
        })
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
