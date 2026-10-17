/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  ASTNode,
  CallExpression,
  Range,
  RuleContext,
  RuleFixer
} from '../../types/index.ts'

import {
  defineScriptSetupVisitor,
  getScriptSetupElement,
  isVElement,
  hasAttribute
} from '../../utils/index.ts'

export default {
  supported: '>=3.3.0',

  createScriptVisitor(context: RuleContext) {
    const sourceCode = context.sourceCode
    return defineScriptSetupVisitor(context, {
      onDefineOptionsEnter(node: any) {
        context.report({
          node,
          messageId: 'forbiddenDefineOptions',
          fix(fixer: any) {
            return fix(fixer, node)
          }
        })
      }
    })

    function fix(fixer: RuleFixer, node: CallExpression) {
      if (node.arguments.length === 0) return null
      const scriptSetup = getScriptSetupElement(context)
      if (
        !scriptSetup ||
        scriptSetup.parent.children
          .filter(isVElement)
          .some(
            (node: any) =>
              node.name === 'script' && !hasAttribute(node, 'setup')
          )
      ) {
        // has `<script>`
        return null
      }

      // Find defineOptions statement

      let statement: ASTNode = node
      while (statement.parent && statement.parent.type !== 'Program') {
        statement = statement.parent
      }
      // Calc remove range

      const removeRange: Range = [...statement.range]
      if (
        sourceCode.lines[statement.loc.start.line - 1]
          .slice(0, statement.loc.start.column)
          .trim() === ''
      ) {
        removeRange[0] -= statement.loc.start.column
      }

      return [
        fixer.insertTextBefore(
          scriptSetup,
          `<script>\nexport default ${sourceCode.getText(
            node.arguments[0]
          )}\n</script>\n`
        ),
        fixer.removeRange(removeRange)
      ]
    }
  }
}
