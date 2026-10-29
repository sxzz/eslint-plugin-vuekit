/**
 * @author Wayne Zhang
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext, Token } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import { isScriptSetup } from '../utils/index.ts'

const COMPILER_MACROS = new Set([
  'defineProps',
  'defineEmits',
  'defineExpose',
  'withDefaults',
  'defineModel',
  'defineOptions',
  'defineSlots'
])

const VUE_MODULES = new Set(['@vue/runtime-core', '@vue/runtime-dom', 'vue'])

function isComma(node: Token) {
  return node.type === 'Punctuator' && node.value === ','
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow importing Vue compiler macros',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-import-compiler-macros.html'
    },
    fixable: 'code',
    schema: [],
    messages: {
      noImportCompilerMacros:
        "'{{name}}' is a compiler macro and doesn't need to be imported.",
      onlyValidInScriptSetup:
        "'{{name}}' is a compiler macro and can only be used inside <script setup>."
    }
  },

  create(context: RuleContext) {
    const sourceCode = context.sourceCode

    return {
      ImportDeclaration(node: any) {
        if (node.specifiers.length === 0 || !VUE_MODULES.has(node.source.value))
          return

        for (const specifier of node.specifiers) {
          if (
            specifier.type !== 'ImportSpecifier' ||
            !COMPILER_MACROS.has(specifier.imported.name)
          ) {
            continue
          }

          context.report({
            node: specifier,
            messageId: isScriptSetup(context)
              ? 'noImportCompilerMacros'
              : 'onlyValidInScriptSetup',
            data: {
              name: specifier.imported.name
            },
            fix: (fixer: any) => {
              const isOnlySpecifier = node.specifiers.length === 1
              const isLastSpecifier = specifier === node.specifiers.at(-1)

              if (isOnlySpecifier) {
                return fixer.remove(node)
              }
              if (isLastSpecifier) {
                const precedingComma = sourceCode.getTokenBefore(
                  specifier,
                  isComma
                )
                return fixer.removeRange([
                  (precedingComma || specifier).range[0],
                  specifier.range[1]
                ])
              }
              const subsequentComma = sourceCode.getTokenAfter(
                specifier,
                isComma
              )
              return fixer.removeRange([
                specifier.range[0],
                (subsequentComma || specifier).range[1]
              ])
            }
          })
        }
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
