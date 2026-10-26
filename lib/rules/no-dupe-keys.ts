/**
 * @fileoverview Prevents duplication of field names.
 * @author Armano
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule
} from '../types/rule.ts'

import type {
  ASTNode,
  CallExpression,
  ESNode,
  Expression,
  Identifier,
  Pattern,
  RuleContext,
  VariableDeclarator
} from '../types/index.ts'

import { findVariable } from '@eslint-community/eslint-utils'
import * as utils from '../utils/index.ts'

export type GroupName = import('../utils').GroupName
export type Variable = import('../types/rule.ts').Scope.Variable
export type ComponentProp = import('../utils').ComponentProp
export type ComponentModel = import('../utils').ComponentModel

const GROUP_NAMES = ['props', 'computed', 'data', 'methods', 'setup']

/**
 * Gets the props pattern node from given `defineProps()` node
 */
function getPropsPattern(node: CallExpression) {
  let target = node
  if (
    target.parent &&
    target.parent.type === 'CallExpression' &&
    target.parent.arguments[0] === target &&
    target.parent.callee.type === 'Identifier' &&
    target.parent.callee.name === 'withDefaults'
  ) {
    target = target.parent
  }

  if (
    !target.parent ||
    target.parent.type !== 'VariableDeclarator' ||
    target.parent.init !== target
  ) {
    return null
  }
  return target.parent.id
}

/**
 * Checks whether the initialization of the given variable declarator node contains one of the references.
 */
function isInsideInitializer(node: VariableDeclarator, references: ESNode[]) {
  const init = node.init
  if (!init) {
    return false
  }
  return references.some(
    (id: any) => init.range[0] <= id.range[0] && id.range[1] <= init.range[1]
  )
}

/**
 * Gets the name of the prop that the given expression reads from the props object.
 */
function getAliasedPropName(node: Expression, propReferences: ESNode[]) {
  const expression = utils.skipChainExpression(utils.skipTSAsExpression(node))

  // `props.foo` or `props['foo']`
  if (expression.type === 'MemberExpression') {
    return propReferences.includes(utils.skipTSAsExpression(expression.object))
      ? utils.getStaticPropertyName(expression)
      : null
  }

  // `toRef(props, 'foo')`
  if (
    expression.type === 'CallExpression' &&
    expression.callee.type === 'Identifier' &&
    expression.callee.name === 'toRef' &&
    propReferences.includes(expression.arguments[0])
  ) {
    const key = expression.arguments[1]
    return key?.type === 'Literal' && typeof key.value === 'string'
      ? key.value
      : null
  }

  return null
}

/**
 * Checks whether the given expression evaluates to the props object itself,
 * e.g. `props`, `defineProps()` or `toRefs(props)`.
 */
function isPropsObject(node: Expression, propReferences: ESNode[]) {
  if (propReferences.includes(node)) {
    return true
  }
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === 'toRefs' &&
    propReferences.includes(node.arguments[0])
  )
}

/**
 * Checks whether the given variable declarator binds `propName` to a *different* prop,
 * e.g. `const foo = toRef(props, 'bar')`. Such a declaration shadows the `propName` prop
 * in the template, so it is a duplicate key even though it reads from the props object.
 * Declarations whose source prop cannot be resolved are not reported.
 */
function aliasesOtherProp(
  node: VariableDeclarator,
  propName: string,
  propReferences: ESNode[]
) {
  const init = node.init
  if (!init) {
    return false
  }

  if (node.id.type === 'Identifier' && node.id.name === propName) {
    const aliased = getAliasedPropName(init, propReferences)
    return aliased !== null && aliased !== propName
  }

  if (node.id.type === 'ObjectPattern' && isPropsObject(init, propReferences)) {
    for (const property of node.id.properties) {
      if (property.type !== 'Property') continue
      const value =
        property.value.type === 'AssignmentPattern'
          ? property.value.left
          : property.value
      if (value.type !== 'Identifier' || value.name !== propName) continue
      const key = utils.getStaticPropertyName(property)
      return key !== null && key !== propName
    }
  }

  return false
}

/**
 * Collects all renamed props from a pattern
 */
function collectRenamedProps(pattern: Pattern | null) {
  const renamedProps = new Set()

  if (!pattern || pattern.type !== 'ObjectPattern') {
    return renamedProps
  }

  for (const prop of pattern.properties) {
    if (prop.type !== 'Property') continue

    if (
      prop.key.type === 'Identifier' &&
      prop.value.type === 'Identifier' &&
      prop.key.name !== prop.value.name
    ) {
      renamedProps.add(prop.key.name)
    }
  }

  return renamedProps
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow duplication of field names',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/no-dupe-keys.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          groups: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      duplicateKey:
        "Duplicate key '{{name}}'. May cause name collision in script or template tag."
    }
  },

  create(context: RuleContext) {
    const options = context.options[0] || {}
    const groups = new Set([...GROUP_NAMES, ...(options.groups || [])])
    let propReferences: ESNode[] = []
    const propNames = new Set<string>()
    const models: { node: CallExpression; model: ComponentModel }[] = []
    const reportedDeclarations = new Set<ASTNode>()

    return utils.compositingVisitors(
      utils.executeOnVue(context, (obj: any) => {
        const properties = utils.iterateProperties(obj, groups)

        const usedNames = new Set()
        for (const o of properties) {
          if (usedNames.has(o.name)) {
            context.report({
              node: o.node,
              messageId: 'duplicateKey',
              data: {
                name: o.name
              }
            })
          }

          usedNames.add(o.name)
        }
      }),
      utils.defineScriptSetupVisitor(context, {
        onDefinePropsEnter(node: any, props: any) {
          const propsNode = getPropsPattern(node)
          propReferences = [
            ...(propsNode ? extractReferences(propsNode) : []),
            node
          ]

          const renamedProps = collectRenamedProps(propsNode)

          for (const prop of props) {
            const propName = prop.propName
            if (!propName) continue
            propNames.add(propName)

            if (renamedProps.has(propName)) {
              continue
            }

            const variable = (
              findVariable as unknown as WithVue<typeof findVariable>
            )(utils.getScope(context, node), propName)
            if (!variable || variable.defs.length === 0) continue

            if (
              variable.defs.some((def) => {
                if (def.type !== 'Variable') return false
                // Reading the props object does not make the declaration an alias
                // of this prop, e.g. `const foo = toRef(props, 'bar')`.
                if (aliasesOtherProp(def.node, propName, propReferences)) {
                  return false
                }
                return isInsideInitializer(def.node, propReferences)
              })
            ) {
              continue
            }

            reportedDeclarations.add(variable.defs[0].node)
            context.report({
              node: variable.defs[0].node,
              messageId: 'duplicateKey',
              data: {
                name: propName
              }
            })
          }
        },
        onDefineModelEnter(node, model) {
          models.push({ node, model })
        },
        'Program:exit'() {
          const usedNames = new Set(propNames)
          for (const { node, model } of models) {
            const name = model.name.modelName
            if (usedNames.has(name)) {
              // `const foo = defineModel('foo')` next to a `foo` prop
              // is already reported on the declaration by the props check
              if (reportedDeclarations.has(node.parent)) continue
              context.report({
                node: model.name.node || node,
                messageId: 'duplicateKey',
                data: { name }
              })
              continue
            }
            usedNames.add(name)

            const variable = (
              findVariable as unknown as WithVue<typeof findVariable>
            )(utils.getScope(context, node), name)
            if (!variable || variable.defs.length === 0) continue

            const modelPattern = getPropsPattern(node)
            const modelReferences = [
              ...propReferences,
              ...(modelPattern ? extractReferences(modelPattern) : []),
              node
            ]
            if (
              variable.defs.some(
                (def) =>
                  def.type === 'Variable' &&
                  isInsideInitializer(def.node, modelReferences)
              )
            ) {
              continue
            }

            context.report({
              node: variable.defs[0].node,
              messageId: 'duplicateKey',
              data: { name }
            })
          }
        }
      })
    )

    /**
     * Extracts references from the given node.
     */
    function extractReferences(node: Pattern): Identifier[] {
      if (node.type === 'Identifier') {
        const variable = (
          findVariable as unknown as WithVue<typeof findVariable>
        )(utils.getScope(context, node), node)
        if (!variable) {
          return []
        }
        return variable.references
          .map((ref) => ref.identifier)
          .filter((node): node is Identifier => node.type === 'Identifier')
      }
      if (node.type === 'ObjectPattern') {
        return node.properties.flatMap((prop: any) =>
          extractReferences(prop.type === 'Property' ? prop.value : prop)
        )
      }
      if (node.type === 'AssignmentPattern') {
        return extractReferences(node.left)
      }
      if (node.type === 'RestElement') {
        return extractReferences(node.argument)
      }
      return []
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
