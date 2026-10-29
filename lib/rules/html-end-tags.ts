/**
 * @author Toru Nagashima
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  defineTemplateBodyVisitor,
  isHtmlVoidElementName,
  hasInvalidEOF
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce end tag style',
      categories: ['vue3-strongly-recommended'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/html-end-tags.html'
    },
    fixable: 'code',
    schema: [],
    messages: {
      missingEndTag: "'<{{name}}>' should have end tag."
    }
  },

  create(context: RuleContext) {
    let hasTemplateEOFError = false

    return defineTemplateBodyVisitor(
      context,
      {
        VElement(node: any) {
          if (hasTemplateEOFError) {
            return
          }

          const name = node.name
          const isVoid = isHtmlVoidElementName(name)
          const isSelfClosing = node.startTag.selfClosing
          const hasEndTag = node.endTag != null

          if (!isVoid && !hasEndTag && !isSelfClosing) {
            context.report({
              node: node.startTag,
              loc: node.startTag.loc,
              messageId: 'missingEndTag',
              data: { name },
              fix: (fixer: any) => fixer.insertTextAfter(node, `</${name}>`)
            })
          }
        }
      },
      {
        Program(node: any) {
          hasTemplateEOFError = hasInvalidEOF(node)
        }
      }
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
