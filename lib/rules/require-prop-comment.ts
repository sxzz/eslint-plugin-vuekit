/**
 * @author CZB
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, Token } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import type { ComponentProp } from '../utils/index.ts'
import {
  compositingVisitors,
  defineScriptSetupVisitor,
  defineVueVisitor,
  getComponentPropsFromOptions
} from '../utils/index.ts'
import { isBlockComment, isJSDocComment } from '../utils/comments.ts'

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'require props to have a comment',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/require-prop-comment.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          type: { enum: ['JSDoc', 'line', 'block', 'any'] }
        },
        additionalProperties: false
      }
    ],
    messages: {
      requireAnyComment: 'The "{{name}}" property should have a comment.',
      requireLineComment: 'The "{{name}}" property should have a line comment.',
      requireBlockComment:
        'The "{{name}}" property should have a block comment.',
      requireJSDocComment:
        'The "{{name}}" property should have a JSDoc comment.'
    }
  },
  create(context: RuleContext) {
    const schema: { type?: 'JSDoc' | 'line' | 'block' | 'any' } | undefined =
      context.options[0]
    const type = (schema && schema.type) || 'JSDoc'

    const sourceCode = context.sourceCode

    const verifyBlock = (comment: Token | undefined) =>
      comment && isBlockComment(comment) ? undefined : 'requireBlockComment'

    const verifyLine = (comment: Token | undefined) =>
      comment && comment.type === 'Line' ? undefined : 'requireLineComment'

    const verifyAny = (comment: Token | undefined) =>
      comment ? undefined : 'requireAnyComment'

    const verifyJSDoc = (comment: Token | undefined) =>
      comment && isJSDocComment(comment) ? undefined : 'requireJSDocComment'

    const verifyComment = (comment: Token | undefined): string | undefined => {
      switch (type) {
        case 'block': {
          return verifyBlock(comment)
        }
        case 'line': {
          return verifyLine(comment)
        }
        case 'any': {
          return verifyAny(comment)
        }
        default: {
          return verifyJSDoc(comment)
        }
      }
    }

    function verifyProps(props: ComponentProp[]) {
      for (const prop of props) {
        if (!prop.propName || prop.type === 'infer-type') {
          continue
        }

        const precedingComments = sourceCode.getCommentsBefore(prop.node)
        const lastPrecedingComment = precedingComments.at(-1)

        const messageId = verifyComment(lastPrecedingComment)

        if (!messageId) {
          continue
        }

        context.report({
          node: prop.node,
          messageId,
          data: {
            name: prop.propName
          }
        })
      }
    }

    return compositingVisitors(
      defineScriptSetupVisitor(context, {
        onDefinePropsEnter(_node, props) {
          verifyProps(props)
        }
      }),
      defineVueVisitor(context, {
        onVueObjectEnter(node) {
          verifyProps(getComponentPropsFromOptions(node))
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
