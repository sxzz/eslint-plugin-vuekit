/**
 * @author Eduard Deisling
 * See LICENSE file in root directory for full license.
 */
import type {
  ASTNode,
  CallExpression,
  Program,
  RuleContext,
  RuleFixer,
  Token,
  VElement
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  getScriptSetupElement,
  compositingVisitors,
  defineScriptSetupVisitor,
  isDef,
  isInRange
} from '../utils/index.ts'

const MACROS_EMITS = 'defineEmits'
const MACROS_PROPS = 'defineProps'
const MACROS_OPTIONS = 'defineOptions'
const MACROS_SLOTS = 'defineSlots'
const MACROS_MODEL = 'defineModel'
const MACROS_EXPOSE = 'defineExpose'
const KNOWN_MACROS = new Set([
  MACROS_EMITS,
  MACROS_PROPS,
  MACROS_OPTIONS,
  MACROS_SLOTS,
  MACROS_MODEL,
  MACROS_EXPOSE
])
const DEFAULT_ORDER = [MACROS_PROPS, MACROS_EMITS]

function isDeclareStatement(node: ASTNode) {
  return 'declare' in node && node.declare === true
}

function isUseStrictStatement(node: ASTNode) {
  return (
    node.type === 'ExpressionStatement' &&
    node.expression.type === 'Literal' &&
    node.expression.value === 'use strict'
  )
}

/**
 * Get an index of the first statement after imports and interfaces in order
 * to place defineEmits and defineProps before this statement
 */
function getTargetStatementPosition(scriptSetup: VElement, program: Program) {
  const skipStatements = new Set([
    'ImportDeclaration',
    'TSEnumDeclaration',
    'TSModuleDeclaration',
    'TSInterfaceDeclaration',
    'TSTypeAliasDeclaration',
    'DebuggerStatement',
    'EmptyStatement',
    'ExportNamedDeclaration'
  ])

  for (const [index, item] of program.body.entries()) {
    if (
      isInRange(scriptSetup, item) &&
      !skipStatements.has(item.type) &&
      !isDeclareStatement(item) &&
      !isUseStrictStatement(item)
    ) {
      return index
    }
  }

  return -1
}

/**
 * We need to handle cases like "const props = defineProps(...)"
 * Define macros must be used only on top, so we can look for "Program" type
 * inside node.parent.type
 */
function getDefineMacrosStatement(node: CallExpression | ASTNode): ASTNode {
  if (!node.parent) {
    throw new Error('Node has no parent')
  }

  return node.parent.type === 'Program'
    ? node
    : getDefineMacrosStatement(node.parent)
}

function create(context: RuleContext) {
  const scriptSetup = getScriptSetupElement(context)

  if (!scriptSetup) {
    return {}
  }

  const options = context.options

  const order = (options[0] && options[0].order) || DEFAULT_ORDER

  const defineExposeLast = (options[0] && options[0].defineExposeLast) || false
  if (defineExposeLast && order.includes(MACROS_EXPOSE)) {
    throw new Error(
      "`defineExpose` macro can't be in the `order` array if `defineExposeLast` is true."
    )
  }

  const sourceCode = context.sourceCode

  const macrosNodes = new Map()

  let defineExposeNode: ASTNode

  return compositingVisitors(
    defineScriptSetupVisitor(context, {
      onDefinePropsExit(node: any) {
        macrosNodes.set(MACROS_PROPS, [getDefineMacrosStatement(node)])
      },
      onDefineEmitsExit(node: any) {
        macrosNodes.set(MACROS_EMITS, [getDefineMacrosStatement(node)])
      },
      onDefineOptionsExit(node: any) {
        macrosNodes.set(MACROS_OPTIONS, [getDefineMacrosStatement(node)])
      },
      onDefineSlotsExit(node: any) {
        macrosNodes.set(MACROS_SLOTS, [getDefineMacrosStatement(node)])
      },
      onDefineModelExit(node: any) {
        const currentModelMacros = macrosNodes.get(MACROS_MODEL) ?? []
        currentModelMacros.push(getDefineMacrosStatement(node))
        macrosNodes.set(MACROS_MODEL, currentModelMacros)
      },
      onDefineExposeExit(node: any) {
        defineExposeNode = getDefineMacrosStatement(node)
      },

      'Program > ExpressionStatement > CallExpression, Program > VariableDeclaration > VariableDeclarator > CallExpression'(
        node: CallExpression
      ) {
        if (
          node.callee &&
          node.callee.type === 'Identifier' &&
          order.includes(node.callee.name) &&
          !KNOWN_MACROS.has(node.callee.name)
        ) {
          macrosNodes.set(node.callee.name, [getDefineMacrosStatement(node)])
        }
      }
    }),
    {
      'Program:exit'(program: any) {
        const firstStatementIndex = getTargetStatementPosition(
          scriptSetup,
          program
        )
        const orderedList = order
          .flatMap((name: any) => {
            const nodes = macrosNodes.get(name) ?? []
            return nodes.map((node: any) => ({ name, node }))
          })
          .filter((data: any) => isDef(data.node))

        // check last node
        if (defineExposeLast) {
          const lastNode = program.body.at(-1)
          if (defineExposeNode && lastNode && lastNode !== defineExposeNode) {
            reportExposeNotOnBottom(defineExposeNode, lastNode)
          }
        }

        for (const [index, should] of orderedList.entries()) {
          const targetStatement = program.body[firstStatementIndex + index]

          if (should.node !== targetStatement) {
            let moveTargetNodes = orderedList
              .slice(index)
              .map(({ node }: any) => node)
            const targetStatementIndex =
              moveTargetNodes.indexOf(targetStatement)

            if (targetStatementIndex !== -1) {
              moveTargetNodes = moveTargetNodes.slice(0, targetStatementIndex)
            }
            reportNotOnTop(should.name, moveTargetNodes, targetStatement)
            return
          }
        }
      }
    }
  )

  function reportNotOnTop(macro: string, nodes: ASTNode[], before: ASTNode) {
    // Determine if 'before' is a macro from the order list
    const beforeMacro = order.find((macroName: any) =>
      (macrosNodes.get(macroName) ?? []).includes(before)
    )

    // Decide which message to use
    const messageId = beforeMacro ? 'macrosUnordered' : 'macrosNotAtTop'
    const data = { macro, ...(beforeMacro ? { before: beforeMacro } : {}) }

    context.report({
      node: nodes[0],
      loc: nodes[0].loc,
      messageId,
      data,
      *fix(fixer: any) {
        for (const node of nodes) {
          yield* moveNodeBefore(fixer, node, before)
        }
      }
    })
  }

  function reportExposeNotOnBottom(node: ASTNode, lastNode: ASTNode) {
    context.report({
      node,
      loc: node.loc,
      messageId: 'defineExposeNotTheLast',
      suggest: [
        {
          messageId: 'putExposeAtTheLast',
          fix(fixer: any) {
            return moveNodeToLast(fixer, node, lastNode)
          }
        }
      ]
    })
  }

  /**
   * Move all lines of "node" with its comments to after the "target"
   */
  function moveNodeToLast(fixer: RuleFixer, node: ASTNode, target: ASTNode) {
    // get comments under tokens(if any)
    const beforeNodeToken = sourceCode.getTokenBefore(node)
    const nodeComment = sourceCode.getTokenAfter(beforeNodeToken, {
      includeComments: true
    })
    const nextNodeComment = sourceCode.getTokenAfter(node, {
      includeComments: true
    })

    // remove position: node (and comments) to next node (and comments)
    const cutStart = getLineStartIndex(nodeComment, beforeNodeToken)
    const cutEnd = getLineStartIndex(nextNodeComment, node)

    // insert text: comment + node
    const textNode = sourceCode.getText(
      node,
      node.range[0] - beforeNodeToken.range[1]
    )

    return [
      fixer.insertTextAfter(target, textNode),
      fixer.removeRange([cutStart, cutEnd])
    ]
  }

  /**
   * Move all lines of "node" with its comments to before the "target"
   */
  function moveNodeBefore(fixer: RuleFixer, node: ASTNode, target: ASTNode) {
    // get comments under tokens(if any)
    const beforeNodeToken = sourceCode.getTokenBefore(node)
    const nodeComment = sourceCode.getTokenAfter(beforeNodeToken, {
      includeComments: true
    })
    const nextNodeComment = sourceCode.getTokenAfter(node, {
      includeComments: true
    })
    // get positions of what we need to remove
    const cutStart = getLineStartIndex(nodeComment, beforeNodeToken)
    const cutEnd = getLineStartIndex(nextNodeComment, node)
    // get space before target
    const beforeTargetToken = sourceCode.getTokenBefore(target)
    const targetComment = sourceCode.getTokenAfter(beforeTargetToken, {
      includeComments: true
    })
    // make insert text: comments + node + space before target
    const textNode = sourceCode.getText(
      node,
      node.range[0] - nodeComment.range[0]
    )
    const insertText = getInsertText(textNode, target)

    return [
      fixer.insertTextBefore(targetComment, insertText),
      fixer.removeRange([cutStart, cutEnd])
    ]
  }

  /**
   * Get result text to insert
   */
  function getInsertText(textNode: string, target: ASTNode) {
    const afterTargetComment = sourceCode.getTokenAfter(target, {
      includeComments: true
    })
    const afterText = sourceCode.text.slice(
      target.range[1],
      afterTargetComment.range[0]
    )
    // handle case when a();b() -> b()a();
    const isInvalidResult = !textNode.endsWith(';') && !afterText.includes('\n')

    return textNode + afterText + (isInvalidResult ? ';' : '')
  }

  /**
   * Get position of the beginning of the token's line(or prevToken end if no line)
   */
  function getLineStartIndex(
    token: ASTNode | Token,
    prevToken: ASTNode | Token
  ) {
    // if we have next token on the same line - get index right before that token
    if (token.loc.start.line === prevToken.loc.end.line) {
      return prevToken.range[1]
    }

    return sourceCode.getIndexFromLoc({
      line: token.loc.start.line,
      column: 0
    })
  }
}

const rule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'enforce order of compiler macros (`defineProps`, `defineEmits`, etc.)',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/define-macros-order.html'
    },
    fixable: 'code',
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          order: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1
            },
            uniqueItems: true
          },
          defineExposeLast: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      macrosNotAtTop:
        '{{macro}} should be placed at the top of `<script setup>` (after any potential import statements or type definitions).',
      macrosUnordered: '{{macro}} should be above {{before}}.',
      defineExposeNotTheLast:
        '`defineExpose` should be the last statement in `<script setup>`.',
      putExposeAtTheLast:
        'Put `defineExpose` as the last statement in `<script setup>`.'
    }
  },
  create
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
