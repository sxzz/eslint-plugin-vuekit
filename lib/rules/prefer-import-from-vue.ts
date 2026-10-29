/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type { ImportDeclaration, Literal, RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import vue3ExportNamesList from '../utils/vue3-export-names.json' with { type: 'json' }

const vue3ExportNames = new Set(vue3ExportNamesList)

const TARGET_AT_VUE_MODULES = new Set([
  '@vue/runtime-dom',
  '@vue/runtime-core',
  '@vue/reactivity',
  '@vue/shared'
])

function* extractSpecifierNames(
  specifier: ImportDeclaration['specifiers'][number]
) {
  switch (specifier.type) {
    case 'ImportDefaultSpecifier': {
      yield 'default'
      break
    }
    case 'ImportNamespaceSpecifier': {
      yield null // all
      break
    }
    case 'ImportSpecifier': {
      yield specifier.imported.type === 'Identifier'
        ? specifier.imported.name
        : specifier.imported.value
      break
    }
  }
}

function* extractImportNames(node: ImportDeclaration) {
  for (const specifier of node.specifiers) {
    yield* extractSpecifierNames(specifier)
  }
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: "enforce import from 'vue' instead of import from '@vue/*'",
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/prefer-import-from-vue.html'
    },
    fixable: 'code',
    schema: [],
    messages: {
      importedAtVue: "Import from 'vue' instead of '{{source}}'."
    }
  },

  create(context: RuleContext) {
    function verifySource(
      source: Literal & { value: string },
      canFix: () => boolean,
      names: string[]
    ) {
      // Don't report when none of the named bindings are re-exported by 'vue'.
      if (
        !TARGET_AT_VUE_MODULES.has(source.value) ||
        (names.length > 0 &&
          names.every((name: any) => !vue3ExportNames.has(name)))
      ) {
        return
      }

      context.report({
        node: source,
        messageId: 'importedAtVue',
        data: { source: source.value },
        fix: canFix()
          ? (fixer: any) =>
              fixer.replaceTextRange(
                [source.range[0] + 1, source.range[1] - 1],
                'vue'
              )
          : null
      })
    }

    return {
      ImportDeclaration(node: any) {
        // Skip imports without specifiers in `.d.ts` files
        if (node.specifiers.length === 0 && context.filename.endsWith('.d.ts'))
          return

        const hasOnlyNamedSpecifiers = node.specifiers.every(
          (specifier: any) => specifier.type === 'ImportSpecifier'
        )
        const importedNames = hasOnlyNamedSpecifiers
          ? node.specifiers.map((specifier: any) => specifier.imported.name)
          : []

        verifySource(
          node.source,
          () => {
            for (const name of extractImportNames(node)) {
              if (
                name == null || // import all
                !vue3ExportNames.has(name) // If there is a name that is not exported from 'vue', it will not be auto-fixed.
              ) {
                return false
              }
            }
            return true
          },
          importedNames
        )
      },
      ExportNamedDeclaration(node: any) {
        if (node.source) {
          verifySource(
            node.source,
            () => {
              for (const specifier of node.specifiers) {
                if (!vue3ExportNames.has(specifier.local.name)) {
                  // If there is a name that is not exported from 'vue', it will not be auto-fixed.
                  return false
                }
              }
              return true
            },
            node.specifiers.map((specifier: any) => specifier.local.name)
          )
        }
      },
      ExportAllDeclaration(node: any) {
        verifySource(
          node.source,
          // If we change it to `from 'vue'`, it will export more, so it will not be auto-fixed.
          () => false,
          []
        )
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
