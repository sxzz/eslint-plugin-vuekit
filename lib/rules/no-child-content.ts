/**
 * @author Flo Edelmann
 * See LICENSE file in root directory for full license.
 */
import type {
  Position,
  RuleContext,
  Token,
  VDirective,
  VNode
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { defineTemplateBodyVisitor } from '../utils/index.ts'
import { isNotEmptyTextNode } from '../utils/indent-utils.ts'

export type RuleOption = { additionalDirectives: string[] }

function comparePositions(pos1: Position, pos2: Position) {
  if (
    pos1.line < pos2.line ||
    (pos1.line === pos2.line && pos1.column < pos2.column)
  ) {
    return 'less'
  }

  return pos1.line > pos2.line ||
    (pos1.line === pos2.line && pos1.column > pos2.column)
    ? 'greater'
    : 'equal'
}

function getLocationRange(nodes: (VNode | Token)[]) {
  let start

  let end

  for (const node of nodes) {
    if (!start || comparePositions(node.loc.start, start) === 'less') {
      start = node.loc.start
    }

    if (!end || comparePositions(node.loc.end, end) === 'greater') {
      end = node.loc.end
    }
  }

  return start === undefined || end === undefined ? undefined : { start, end }
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        "disallow element's child contents which would be overwritten by a directive like `v-html` or `v-text`",
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/no-child-content.html'
    },
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          additionalDirectives: {
            type: 'array',
            uniqueItems: true,
            minItems: 1,
            items: {
              type: 'string'
            }
          }
        },
        required: ['additionalDirectives']
      }
    ],
    messages: {
      disallowedChildContent:
        'Child content is disallowed because it will be overwritten by the v-{{ directiveName }} directive.',
      removeChildContent: 'Remove child content.'
    }
  },

  create(context: RuleContext) {
    const directives = new Set(['html', 'text'])

    const option = context.options[0]
    if (option !== undefined) {
      for (const directive of option.additionalDirectives) {
        directives.add(directive)
      }
    }

    return defineTemplateBodyVisitor(context, {
      'VAttribute[directive=true]'(directiveNode: VDirective) {
        const directiveName = directiveNode.key.name.name
        const elementNode = directiveNode.parent.parent

        if (elementNode.endTag === null || !directives.has(directiveName)) {
          return
        }
        const sourceCode = context.sourceCode
        const tokenStore = sourceCode.parserServices.getTemplateBodyTokenStore()
        const elementComments = tokenStore.getTokensBetween(
          elementNode.startTag,
          elementNode.endTag,
          {
            includeComments: true,
            filter: (token: any) => token.type === 'HTMLComment'
          }
        )

        const childNodes = [...elementNode.children, ...elementComments]

        if (childNodes.some((childNode) => isNotEmptyTextNode(childNode))) {
          context.report({
            node: elementNode,
            loc: getLocationRange(childNodes),
            messageId: 'disallowedChildContent',
            data: { directiveName },
            suggest: [
              {
                messageId: 'removeChildContent',
                *fix(fixer: any) {
                  for (const childNode of childNodes) {
                    yield fixer.remove(childNode)
                  }
                }
              }
            ]
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
