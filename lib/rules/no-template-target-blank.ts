/**
 * @fileoverview disallow target="_blank" attribute without rel="noopener noreferrer"
 * @author Sosukesuzuki
 */
import type { RuleContext, VAttribute, VStartTag } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

function isTargetBlank(node: VAttribute) {
  return (
    node.key &&
    node.key.name === 'target' &&
    node.value &&
    node.value.value === '_blank'
  )
}

function hasSecureRel(node: VStartTag, shouldAllowReferrer: boolean) {
  return node.attributes.some((attr: any) => {
    if (attr.key && attr.key.name === 'rel') {
      const tags =
        attr.value &&
        attr.value.type === 'VLiteral' &&
        attr.value.value.toLowerCase().split(' ')
      return (
        tags &&
        tags.includes('noopener') &&
        (shouldAllowReferrer || tags.includes('noreferrer'))
      )
    }
    return false
  })
}

function hasExternalLink(node: VStartTag) {
  return node.attributes.some(
    (attr: any) =>
      attr.key &&
      attr.key.name === 'href' &&
      attr.value &&
      attr.value.type === 'VLiteral' &&
      /^(?:\w+:|\/\/)/.test(attr.value.value)
  )
}

function hasDynamicLink(node: VStartTag) {
  return node.attributes.some(
    (attr: any) =>
      attr.key &&
      attr.key.type === 'VDirectiveKey' &&
      attr.key.name &&
      attr.key.name.name === 'bind' &&
      attr.key.argument &&
      attr.key.argument.type === 'VIdentifier' &&
      attr.key.argument.name === 'href'
  )
}

function getSuggestion(node: VAttribute) {
  const relAttributeNode = node.parent.attributes.find(
    (attribute: any) => attribute.key.name === 'rel'
  )

  if (relAttributeNode) {
    return {
      desc: 'Change `rel` attribute value to `noopener noreferrer`.',
      fix(fixer: any) {
        return fixer.replaceText(relAttributeNode, 'rel="noopener noreferrer"')
      }
    }
  }

  return {
    desc: 'Add `rel="noopener noreferrer"`.',
    fix(fixer: any) {
      return fixer.insertTextAfter(node, ' rel="noopener noreferrer"')
    }
  }
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow target="_blank" attribute without rel="noopener noreferrer"',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-template-target-blank.html'
    },
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          allowReferrer: {
            type: 'boolean'
          },
          enforceDynamicLinks: {
            enum: ['always', 'never']
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      missingRel:
        'Using target="_blank" without rel="noopener noreferrer" is a security risk.'
    }
  },

  /**
   * Creates AST event handlers for no-template-target-blank
   */
  create(context: RuleContext) {
    const configuration = context.options[0] || {}
    const allowReferrer = configuration.allowReferrer || false
    const enforceDynamicLinks = configuration.enforceDynamicLinks || 'always'

    return defineTemplateBodyVisitor(context, {
      'VAttribute[directive=false]'(node: VAttribute) {
        if (!isTargetBlank(node) || hasSecureRel(node.parent, allowReferrer)) {
          return
        }

        const hasDangerHref =
          hasExternalLink(node.parent) ||
          (enforceDynamicLinks === 'always' && hasDynamicLink(node.parent))

        if (hasDangerHref) {
          context.report({
            node,
            messageId: 'missingRel',
            suggest: [getSuggestion(node)]
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
