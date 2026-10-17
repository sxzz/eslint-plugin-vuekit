/**
 * @author ItMaga
 * See LICENSE file in root directory for full license.
 */
import type { Program, RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  isVElement,
  isScriptSetup,
  compositingVisitors,
  defineVueVisitor
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'require components to be the default export',
      categories: undefined,
      url: 'https://eslint.vuejs.org/rules/require-default-export.html'
    },
    schema: [],
    messages: {
      missing: 'Missing default export.',
      mustBeDefaultExport: 'Component must be the default export.'
    }
  },

  create(context: RuleContext) {
    const sourceCode = context.sourceCode
    const documentFragment = sourceCode.parserServices.getDocumentFragment?.()

    const hasScript =
      documentFragment &&
      documentFragment.children.some(
        (e: any) => isVElement(e) && e.name === 'script'
      )

    if (!hasScript || isScriptSetup(context)) {
      return {}
    }

    let hasDefaultExport = false
    let hasDefinedComponent = false

    return compositingVisitors(
      defineVueVisitor(context, {
        onVueObjectExit() {
          hasDefinedComponent = true
        }
      }),

      {
        'Program > ExportDefaultDeclaration'() {
          hasDefaultExport = true
        },

        'Program:exit'(node: Program) {
          if (
            !hasDefaultExport &&
            node.body.length > 0 &&
            node.tokens.length > 0
          ) {
            context.report({
              loc: node.tokens.at(-1)!.loc,
              messageId: hasDefinedComponent ? 'mustBeDefaultExport' : 'missing'
            })
          }
        }
      }
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
