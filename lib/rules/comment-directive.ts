/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 */
import type {
  Position,
  RuleContext,
  Token,
  VDocumentFragment
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { isVElement } from '../utils/index.ts'

export type RuleAndLocation = {
  ruleId: string
  index: number
  key?: string
}

const COMMENT_DIRECTIVE_B = /^\s*(eslint-(?:en|dis)able)(?:\s+|$)/
const COMMENT_DIRECTIVE_L = /^\s*(eslint-disable(?:-next)?-line)(?:\s+|$)/

/**
 * Remove the ignored part from a given directive comment and trim it.
 */
function stripDirectiveComment(value: string) {
  return value.split(/\s-{2,}\s/u, 1)[0]
}

/**
 * Parse a given comment.
 */
function parse(pattern: RegExp, comment: string) {
  const text = stripDirectiveComment(comment)
  const match = pattern.exec(text)
  if (match == null) {
    return null
  }

  const type = match[1]

  const rules: RuleAndLocation[] = []

  const rulesRe = /([^\s,]+)[\s,]*/g
  let startIndex = match[0].length
  rulesRe.lastIndex = startIndex

  let res
  while ((res = rulesRe.exec(text))) {
    const ruleId = res[1].trim()
    rules.push({
      ruleId,
      index: startIndex
    })
    startIndex = rulesRe.lastIndex
  }

  return { type, rules }
}

/**
 * Enable rules.
 */
function enable(
  context: RuleContext,
  loc: { line: number; column: number },
  group: 'block' | 'line',
  rule: string | null
) {
  if (rule) {
    context.report({
      loc,
      messageId: group === 'block' ? 'enableBlockRule' : 'enableLineRule',
      data: { rule }
    })
  } else {
    context.report({
      loc,
      messageId: group === 'block' ? 'enableBlock' : 'enableLine'
    })
  }
}

/**
 * Disable rules.
 */
function disable(
  context: RuleContext,
  loc: { line: number; column: number },
  group: 'block' | 'line',
  rule: string | null,
  key: string
) {
  if (rule) {
    context.report({
      loc,
      messageId: group === 'block' ? 'disableBlockRule' : 'disableLineRule',
      data: { rule, key }
    })
  } else {
    context.report({
      loc,
      messageId: group === 'block' ? 'disableBlock' : 'disableLine',
      data: { key }
    })
  }
}

/**
 * Process a given comment token.
 * If the comment is `eslint-disable` or `eslint-enable` then it reports the comment.
 */
function processBlock(
  context: RuleContext,
  comment: Token,
  shouldReportUnusedDisableDirectives: boolean
) {
  const parsed = parse(COMMENT_DIRECTIVE_B, comment.value)
  if (parsed === null) return

  if (parsed.type === 'eslint-disable') {
    if (parsed.rules.length > 0) {
      const rules = shouldReportUnusedDisableDirectives
        ? reportUnusedRules(context, comment, parsed.type, parsed.rules)
        : parsed.rules
      for (const rule of rules) {
        disable(
          context,
          comment.loc.start,
          'block',
          rule.ruleId,
          rule.key || '*'
        )
      }
    } else {
      const key = shouldReportUnusedDisableDirectives
        ? reportUnused(context, comment, parsed.type)
        : ''
      disable(context, comment.loc.start, 'block', null, key)
    }
  } else {
    if (parsed.rules.length > 0) {
      for (const rule of parsed.rules) {
        enable(context, comment.loc.start, 'block', rule.ruleId)
      }
    } else {
      enable(context, comment.loc.start, 'block', null)
    }
  }
}

/**
 * Process a given comment token.
 * If the comment is `eslint-disable-line` or `eslint-disable-next-line` then it reports the comment.
 */
function processLine(
  context: RuleContext,
  comment: Token,
  shouldReportUnusedDisableDirectives: boolean
) {
  const parsed = parse(COMMENT_DIRECTIVE_L, comment.value)
  if (parsed == null || comment.loc.start.line !== comment.loc.end.line) {
    return
  }

  const line =
    comment.loc.start.line + (parsed.type === 'eslint-disable-line' ? 0 : 1)
  const column = -1
  if (parsed.rules.length > 0) {
    const rules = shouldReportUnusedDisableDirectives
      ? reportUnusedRules(context, comment, parsed.type, parsed.rules)
      : parsed.rules
    for (const rule of rules) {
      disable(context, { line, column }, 'line', rule.ruleId, rule.key || '')
      enable(context, { line: line + 1, column }, 'line', rule.ruleId)
    }
  } else {
    const key = shouldReportUnusedDisableDirectives
      ? reportUnused(context, comment, parsed.type)
      : ''
    disable(context, { line, column }, 'line', null, key)
    enable(context, { line: line + 1, column }, 'line', null)
  }
}

/**
 * Reports unused disable directive.
 * Do not check the use of directives here. Filter the directives used with postprocess.
 */
function reportUnused(context: RuleContext, comment: Token, kind: string) {
  const loc = comment.loc

  context.report({
    loc,
    messageId: 'unused',
    data: { kind }
  })

  return locToKey(loc.start)
}

/**
 * Reports unused disable directive rules.
 * Do not check the use of directives here. Filter the directives used with postprocess.
 */
function reportUnusedRules(
  context: RuleContext,
  comment: Token,
  kind: string,
  rules: RuleAndLocation[]
) {
  const sourceCode = context.sourceCode
  const commentStart = comment.range[0] + 4 /* <!-- */

  return rules.map((rule: any) => {
    const start = sourceCode.getLocFromIndex(commentStart + rule.index)
    const end = sourceCode.getLocFromIndex(
      commentStart + rule.index + rule.ruleId.length
    )

    context.report({
      loc: { start, end },
      messageId: 'unusedRule',
      data: { rule: rule.ruleId, kind }
    })

    return {
      ruleId: rule.ruleId,
      key: locToKey(start)
    }
  })
}

/**
 * Gets the key of location
 */
function locToKey(location: Position) {
  return `line:${location.line},column${location.column}`
}

/**
 * Extracts the top-level elements in document fragment.
 */
function extractTopLevelHTMLElements(documentFragment: VDocumentFragment) {
  return documentFragment.children.filter(isVElement)
}
/**
 * Extracts the top-level comments in document fragment.
 */
function extractTopLevelDocumentFragmentComments(
  documentFragment: VDocumentFragment
) {
  const elements = extractTopLevelHTMLElements(documentFragment)

  return documentFragment.comments.filter((comment: any) =>
    elements.every(
      (element: any) =>
        comment.range[1] <= element.range[0] ||
        element.range[1] <= comment.range[0]
    )
  )
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'support comment-directives in `<template>`',
      categories: ['base'],
      url: 'https://eslint.vuejs.org/rules/comment-directive.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          reportUnusedDisableDirectives: {
            type: 'boolean'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      disableBlock: '--block {{key}}',
      enableBlock: '++block',
      disableLine: '--line {{key}}',
      enableLine: '++line',
      disableBlockRule: '-block {{rule}} {{key}}',
      enableBlockRule: '+block {{rule}}',
      disableLineRule: '-line {{rule}} {{key}}',
      enableLineRule: '+line {{rule}}',
      clear: 'clear',

      unused: 'Unused {{kind}} directive (no problems were reported).',
      unusedRule:
        "Unused {{kind}} directive (no problems were reported from '{{rule}}')."
    }
  },

  create(context: RuleContext) {
    const options = context.options[0] || {}

    const reportUnusedDisableDirectives = options.reportUnusedDisableDirectives
    const sourceCode = context.sourceCode
    const documentFragment =
      sourceCode.parserServices.getDocumentFragment &&
      sourceCode.parserServices.getDocumentFragment()

    return {
      Program(node: any) {
        if (node.templateBody) {
          // Send directives to the post-process.
          for (const comment of node.templateBody.comments) {
            processBlock(context, comment, reportUnusedDisableDirectives)
            processLine(context, comment, reportUnusedDisableDirectives)
          }

          // Send a clear mark to the post-process.
          context.report({
            loc: node.templateBody.loc.end,
            messageId: 'clear'
          })
        }
        if (!documentFragment) {
          return
        }

        // Send directives to the post-process.
        for (const comment of extractTopLevelDocumentFragmentComments(
          documentFragment
        )) {
          processBlock(context, comment, reportUnusedDisableDirectives)
          processLine(context, comment, reportUnusedDisableDirectives)
        }

        // Send a clear mark to the post-process.
        for (const element of extractTopLevelHTMLElements(documentFragment)) {
          context.report({
            loc: element.loc.end,
            messageId: 'clear'
          })
        }
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
