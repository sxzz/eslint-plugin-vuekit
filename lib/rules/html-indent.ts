/**
 * @author Toru Nagashima
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { defineVisitor } from '../utils/indent-common.ts'
import { defineTemplateBodyVisitor } from '../utils/index.ts'

const rule = {
  create(context: RuleContext) {
    const sourceCode = context.sourceCode
    const tokenStore =
      sourceCode.parserServices.getTemplateBodyTokenStore &&
      sourceCode.parserServices.getTemplateBodyTokenStore()
    const visitor = defineVisitor(context, tokenStore, {
      baseIndent: 1
    })

    return defineTemplateBodyVisitor(context, visitor)
  },

  meta: {
    type: 'layout',
    docs: {
      description: 'enforce consistent indentation in `<template>`',
      categories: ['vue3-strongly-recommended'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/html-indent.html'
    },

    fixable: 'whitespace',
    schema: [
      {
        oneOf: [{ type: 'integer', minimum: 1 }, { enum: ['tab'] }]
      },
      {
        type: 'object',
        properties: {
          attribute: { type: 'integer', minimum: 0 },
          baseIndent: { type: 'integer', minimum: 0 },
          closeBracket: {
            oneOf: [
              { type: 'integer', minimum: 0 },
              {
                type: 'object',
                properties: {
                  startTag: { type: 'integer', minimum: 0 },
                  endTag: { type: 'integer', minimum: 0 },
                  selfClosingTag: { type: 'integer', minimum: 0 }
                },
                additionalProperties: false
              }
            ]
          },
          switchCase: { type: 'integer', minimum: 0 },
          alignAttributesVertically: { type: 'boolean' },
          ignores: {
            type: 'array',
            items: {
              allOf: [
                { type: 'string' },
                { not: { type: 'string', pattern: ':exit$' } },
                { not: { type: 'string', pattern: String.raw`^\s*$` } }
              ]
            },
            uniqueItems: true
          }
        },
        additionalProperties: false
      }
    ]
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
