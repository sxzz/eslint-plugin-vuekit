/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { Program, RuleContext, VElement } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { isVElement, hasInvalidEOF } from '../utils/index.ts'
import { toRegExp } from '../utils/regexp.ts'

interface ParsedOption {
  test: (block: VElement) => boolean
  message?: string
}

function parseOption(option: any): ParsedOption {
  if (typeof option === 'string') {
    const matcher = toRegExp(option, { remove: 'g' })
    return {
      test(block) {
        return matcher.test(block.rawName)
      }
    }
  }
  const parsed = parseOption(option.element)
  parsed.message = option.message
  return parsed
}

function defaultMessage(block: VElement) {
  return `Using \`<${block.rawName}>\` is not allowed.`
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow specific block',
      categories: undefined,
      url: 'https://eslint.vuejs.org/rules/no-restricted-block.html'
    },
    schema: {
      type: 'array',
      items: {
        oneOf: [
          { type: 'string' },
          {
            type: 'object',
            properties: {
              element: { type: 'string' },
              message: { type: 'string', minLength: 1 }
            },
            required: ['element'],
            additionalProperties: false
          }
        ]
      },
      uniqueItems: true,
      minItems: 0
    },

    messages: {
      restrictedBlock: '{{message}}'
    }
  },
  create(context: RuleContext) {
    const options: ParsedOption[] = context.options.map(parseOption)

    const sourceCode = context.sourceCode
    const documentFragment =
      sourceCode.parserServices.getDocumentFragment &&
      sourceCode.parserServices.getDocumentFragment()

    function getTopLevelHTMLElements() {
      return documentFragment
        ? documentFragment.children.filter(isVElement)
        : []
    }

    return {
      Program(node: Program) {
        if (hasInvalidEOF(node)) {
          return
        }
        for (const block of getTopLevelHTMLElements()) {
          const option = options.find((option) => option.test(block))
          if (!option) {
            continue
          }
          const message = option.message || defaultMessage(block)
          context.report({
            node: block.startTag,
            messageId: 'restrictedBlock',
            data: { message }
          })
        }
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
