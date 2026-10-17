/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  RuleContext,
  VAttribute,
  VDirective,
  VStartTag
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { defineTemplateBodyVisitor } from '../utils/index.ts'

// https://github.com/vuejs/vue-next/blob/64e2f4643602c5980361e66674141e61ba60ef70/packages/compiler-core/src/parse.ts#L405
const SPECIAL_TEMPLATE_DIRECTIVES = new Set([
  'if',
  'else',
  'else-if',
  'for',
  'slot'
])

function getKeyName(attr: VAttribute | VDirective) {
  if (attr.directive) {
    return attr.key.name.name !== 'bind' ||
      !attr.key.argument ||
      attr.key.argument.type === 'VExpressionContainer'
      ? null
      : attr.key.argument.name
  }
  return attr.key.name
}

function isFragmentTemplateAttribute(attr: VAttribute | VDirective) {
  if (attr.directive) {
    const directiveName = attr.key.name.name
    if (SPECIAL_TEMPLATE_DIRECTIVES.has(directiveName)) {
      return true
    }
  }
  return false
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow useless attribute on `<template>`',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/no-useless-template-attributes.html'
    },
    schema: [],
    messages: {
      unexpectedAttr: 'Unexpected useless attribute on `<template>`.',
      unexpectedDir: 'Unexpected useless directive on `<template>`.'
    }
  },

  create(context: RuleContext) {
    return defineTemplateBodyVisitor(context, {
      "VElement[name='template'][parent.type='VElement'] > VStartTag"(
        node: VStartTag
      ) {
        if (!node.attributes.some(isFragmentTemplateAttribute)) {
          return
        }

        for (const attr of node.attributes) {
          if (isFragmentTemplateAttribute(attr)) {
            continue
          }
          const keyName = getKeyName(attr)
          if (keyName === 'key') {
            continue
          }
          context.report({
            node: attr,
            messageId: attr.directive ? 'unexpectedDir' : 'unexpectedAttr'
          })
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
