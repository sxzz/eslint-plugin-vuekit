/**
 * @author Yosuke Ota <https://github.com/ota-meshi>
 * See LICENSE file in root directory for full license.
 */
import type {
  CallExpression,
  ExportDefaultDeclaration,
  ImportDeclaration,
  RuleContext,
  VElement,
  VStartTag
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  getScriptSetupElement,
  compositingVisitors,
  defineScriptSetupVisitor,
  isVElement,
  hasAttribute
} from '../utils/index.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce use of `defineOptions` instead of default export',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/prefer-define-options.html'
    },
    fixable: 'code',
    schema: [],
    messages: {
      preferDefineOptions: 'Use `defineOptions` instead of default export.'
    }
  },

  create(context: RuleContext) {
    const scriptSetup = getScriptSetupElement(context)
    if (!scriptSetup) {
      return {}
    }

    let defineOptionsNode: CallExpression | null = null

    let exportDefaultDeclaration: ExportDefaultDeclaration | null = null

    let lastImportDeclaration: ImportDeclaration | null = null

    return compositingVisitors(
      defineScriptSetupVisitor(context, {
        ImportDeclaration(node: any) {
          lastImportDeclaration = node
        },
        onDefineOptionsEnter(node: any) {
          defineOptionsNode = node
        }
      }),
      {
        ExportDefaultDeclaration(node: any) {
          exportDefaultDeclaration = node
        },
        'Program:exit'() {
          if (!exportDefaultDeclaration) {
            return
          }
          context.report({
            node: exportDefaultDeclaration,
            messageId: 'preferDefineOptions',
            fix: defineOptionsNode
              ? null
              : buildFix(exportDefaultDeclaration, scriptSetup)
          })
        }
      }
    )

    function buildFix(node: ExportDefaultDeclaration, scriptSetup: VElement) {
      return (fixer: any) => {
        const sourceCode = context.sourceCode

        // Calc remove range

        let removeRange = [...node.range]

        const script = scriptSetup.parent.children.find(
          (node): node is VElement =>
            isVElement(node) &&
            node.name === 'script' &&
            !hasAttribute(node, 'setup')
        )
        if (
          script &&
          isVElement(script) &&
          script.endTag &&
          sourceCode
            .getTokensBetween(script.startTag, script.endTag, {
              includeComments: true
            })
            .every(
              (token: any) =>
                removeRange[0] <= token.range[0] &&
                token.range[1] <= removeRange[1]
            )
        ) {
          removeRange = [...script.range]
        }
        const removeStartLoc = sourceCode.getLocFromIndex(removeRange[0])
        if (
          sourceCode.lines[removeStartLoc.line - 1]
            .slice(0, removeStartLoc.column)
            .trim() === ''
        ) {
          removeRange[0] =
            removeStartLoc.line === 1
              ? 0
              : sourceCode.getIndexFromLoc({
                  line: removeStartLoc.line - 1,
                  column: sourceCode.lines[removeStartLoc.line - 2].length
                })
        }

        const insertAfterTag: VStartTag | ImportDeclaration =
          lastImportDeclaration || scriptSetup.startTag

        return [
          fixer.removeRange(removeRange),
          fixer.insertTextAfter(
            insertAfterTag,
            `\ndefineOptions(${sourceCode.getText(node.declaration)})\n`
          )
        ]
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
