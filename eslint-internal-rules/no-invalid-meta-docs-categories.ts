/**
 * @fileoverview Internal rule to prevent missing or invalid meta property in core rules.
 * @author Vitor Balocco
 */
import { findVariable } from '@eslint-community/eslint-utils'

/**
 * Gets the property of the Object node passed in that has the name specified.
 */
function getPropertyFromObject(propertyName: string, node: any): any {
  if (node && node.type === 'ObjectExpression') {
    for (const property of node.properties) {
      if (property.type === 'Property' && property.key.name === propertyName) {
        return property
      }
    }
  }
  return null
}

/**
 * Extracts the `meta` property from the ObjectExpression that all rules export.
 */
function getMetaPropertyFromExportsNode(exportsNode: any) {
  return getPropertyFromObject('meta', exportsNode)
}

/**
 * Checks the validity of the meta definition of this rule and reports any errors found.
 */
function checkMetaValidity(context: any, exportsNode: any) {
  const metaProperty = getMetaPropertyFromExportsNode(exportsNode)
  if (!metaProperty) {
    return
  }

  const metaDocs = getPropertyFromObject('docs', metaProperty.value)
  if (!metaDocs) {
    return
  }

  const categories = getPropertyFromObject('categories', metaDocs.value)
  if (!categories) {
    context.report({
      node: metaDocs,
      messageId: 'missingCategories',
      fix(fixer: any) {
        const category = getPropertyFromObject('category', metaDocs.value)
        if (!category) {
          return null
        }
        const fixes = [fixer.replaceText(category.key, 'categories')]
        if (
          category.value &&
          category.value.type === 'Literal' &&
          typeof category.value.value === 'string'
        ) {
          // fixes.push(fixer.insertTextBefore(category.value, '['), fixer.insertTextAfter(category.value, ']'))

          fixes.push(
            fixer.insertTextBefore(
              category.value,
              category.value.value === 'base'
                ? '['
                : `['vue3-${category.value.value}', ` // for vue3 migration
            ),
            fixer.insertTextAfter(category.value, ']')
          )
        }
        return fixes
      }
    })
    return
  }

  if (
    categories.value &&
    categories.value.type !== 'ArrayExpression' &&
    !(categories.value.type === 'Literal' && categories.value.value == null) &&
    !(
      categories.value.type === 'Identifier' &&
      categories.value.name === 'undefined'
    )
  ) {
    context.report({
      node: categories.value,
      messageId: 'categoriesMustBeArray'
    })
  }
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce correct use of `meta` property in core rules',
      categories: ['Internal']
    },
    // eslint-disable-next-line eslint-plugin/require-meta-fixable -- fixer is not recognized
    fixable: 'code',
    schema: [],
    messages: {
      missingCategories: 'Rule is missing a meta.docs.categories property.',
      // eslint-disable-next-line eslint-plugin/report-message-format
      categoriesMustBeArray: 'meta.docs.categories must be an array.'
    },
    languages: ['js/js']
  },

  create(context: any) {
    let exportsNode: any

    return {
      AssignmentExpression(node: any) {
        if (
          node.left &&
          node.right &&
          node.left.type === 'MemberExpression' &&
          node.left.object.name === 'module' &&
          node.left.property.name === 'exports'
        ) {
          exportsNode = node.right
        }
      },

      ExportDefaultDeclaration(node: any) {
        exportsNode = node.declaration
        const visited = new Set()
        while (exportsNode && !visited.has(exportsNode)) {
          visited.add(exportsNode)
          if (
            exportsNode.type === 'TSAsExpression' ||
            exportsNode.type === 'TSSatisfiesExpression'
          ) {
            exportsNode = exportsNode.expression
          } else if (exportsNode.type === 'Identifier') {
            const variable = findVariable(
              context.sourceCode.getScope(exportsNode),
              exportsNode.name
            )
            const declaration = variable?.defs[0]?.node
            if (declaration?.type !== 'VariableDeclarator') break
            exportsNode = declaration.init
          } else {
            break
          }
        }
      },

      'Program:exit'() {
        checkMetaValidity(context, exportsNode)
      }
    }
  }
}
