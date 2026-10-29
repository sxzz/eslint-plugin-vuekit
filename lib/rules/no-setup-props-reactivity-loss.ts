/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule
} from '../types/rule.ts'

import type {
  ArrowFunctionExpression,
  AssignmentExpression,
  CallExpression,
  ESNode,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Pattern,
  Program,
  RuleContext,
  Super,
  VariableDeclarator
} from '../types/index.ts'

import { findVariable } from '@eslint-community/eslint-utils'
import {
  skipChainExpression,
  isInRange,
  compositingVisitors,
  defineScriptSetupVisitor,
  getScope,
  defineVueVisitor,
  skipDefaultParamValue
} from '../utils/index.ts'

/**
 *    - `'props'`: A node is a container object that has props.
 *    - `'prop'`: A node is a variable with one prop.
 */
export type PropIdKind = 'props' | 'prop'

export type PropId = { node: Pattern; kind: PropIdKind }
/**
 * Iterates over Prop identifiers by parsing the given pattern
 * in the left operand of defineProps().
 */
function* iteratePropIds(node: Pattern) {
  switch (node.type) {
    case 'ObjectPattern': {
      for (const prop of node.properties) {
        yield prop.type === 'Property'
          ? {
              // e.g. `const { prop } = defineProps()`
              node: unwrapAssignment(prop.value),
              kind: 'prop'
            }
          : {
              // RestElement
              // e.g. `const { x, ...prop } = defineProps()`
              node: unwrapAssignment(prop.argument),
              kind: 'props'
            }
      }
      break
    }
    default: {
      // e.g. `const props = defineProps()`
      yield { node: unwrapAssignment(node), kind: 'props' }
    }
  }
}

function unwrapAssignment<T extends Pattern>(node: T): Pattern {
  return node.type === 'AssignmentPattern' ? node.left : node
}

export type ScopePropsReferences = {
  refs: {
    props: Set<Identifier>
    prop: Set<Identifier>
  }
  scopeName: string
}

function isPropsMemberAccessed(
  node: Expression | Super,
  propsReferences: ScopePropsReferences
) {
  for (const props of propsReferences.refs.props) {
    const isPropsInExpressionRange = isInRange(node.range, props)
    const isPropsMemberExpression =
      props.parent.type === 'MemberExpression' && props.parent.object === props

    if (isPropsInExpressionRange && isPropsMemberExpression) {
      return true
    }
  }

  // Checks for actual member access using prop destructuring.
  for (const prop of propsReferences.refs.prop) {
    const isPropsInExpressionRange = isInRange(node.range, prop)
    if (isPropsInExpressionRange) {
      return true
    }
  }

  return false
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'disallow usages that lose the reactivity of `props` passed to `setup`',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-setup-props-reactivity-loss.html'
    },
    schema: [],
    messages: {
      destructuring:
        'Destructuring the `props` will cause the value to lose reactivity.',
      getProperty:
        'Getting a value from the `props` in root scope of `{{scopeName}}` will cause the value to lose reactivity.'
    }
  },

  create(context: RuleContext) {
    const setupScopePropsReferenceIds = new Map()
    const wrapperExpressionTypes = new Set([
      'ArrayExpression',
      'ObjectExpression'
    ])

    function report(node: ESNode, messageId: string, scopeName: string) {
      context.report({
        node,
        messageId,
        data: {
          scopeName
        }
      })
    }

    function verify(
      left: Pattern,
      right: Expression | null,
      propsReferences: ScopePropsReferences
    ) {
      if (!right) {
        return
      }

      const rightNode = skipChainExpression(right)

      if (
        wrapperExpressionTypes.has(rightNode.type) &&
        isPropsMemberAccessed(rightNode, propsReferences)
      ) {
        // e.g. `const foo = { x: props.x }`
        report(rightNode, 'getProperty', propsReferences.scopeName)
        return
      }

      // Get the expression that provides the value.

      let expression: Expression = rightNode
      while (expression.type === 'MemberExpression') {
        const object = skipChainExpression(expression.object)
        if (object.type === 'Super') break
        expression = object
      }

      const expressions = []
      switch (expression.type) {
        case 'TemplateLiteral': {
          expressions.push(...expression.expressions)
          break
        }
        case 'ConditionalExpression': {
          expressions.push(
            expression.test,
            expression.consequent,
            expression.alternate
          )
          break
        }
        case 'Identifier': {
          expressions.push(expression)
          break
        }
      }

      if (
        (left.type === 'ArrayPattern' || left.type === 'ObjectPattern') &&
        expressions.some(
          (expr) =>
            expr.type === 'Identifier' && propsReferences.refs.props.has(expr)
        )
      ) {
        // e.g. `const {foo} = props`
        report(left, 'getProperty', propsReferences.scopeName)
        return
      }

      const reportNode = expressions.find((expr) =>
        isPropsMemberAccessed(expr, propsReferences)
      )
      if (reportNode) {
        report(reportNode, 'getProperty', propsReferences.scopeName)
      }
    }
    type ScopeStack = {
      upper: ScopeStack | null
      scopeNode:
        | FunctionDeclaration
        | FunctionExpression
        | ArrowFunctionExpression
        | Program
    }

    let scopeStack: ScopeStack | null = null

    function processPropId(
      { node, kind }: any,
      scopeNode:
        | FunctionDeclaration
        | FunctionExpression
        | ArrowFunctionExpression
        | Program,
      currentScope: import('../types/rule.ts').Scope.Scope,
      scopeName: string
    ) {
      if (
        // eslint-disable-next-line unicorn/prefer-includes-over-repeated-comparisons -- narrows `node`'s type for the code below
        node.type === 'RestElement' ||
        node.type === 'AssignmentPattern' ||
        node.type === 'MemberExpression'
      ) {
        // cannot check
        return
      }
      if (node.type === 'ArrayPattern' || node.type === 'ObjectPattern') {
        report(node, 'destructuring', scopeName)
        return
      }

      const variable = (
        findVariable as unknown as WithVue<typeof findVariable>
      )(currentScope, node)
      if (!variable) {
        return
      }

      let scopePropsReferences = setupScopePropsReferenceIds.get(scopeNode)
      if (!scopePropsReferences) {
        scopePropsReferences = {
          refs: {
            props: new Set(),
            prop: new Set()
          },
          scopeName
        }
        setupScopePropsReferenceIds.set(scopeNode, scopePropsReferences)
      }
      const propsReferenceIds = scopePropsReferences.refs[kind]
      for (const reference of variable.references) {
        if (
          reference.identifier.type !== 'Identifier' ||
          // If reference is in another scope, we can't check it.
          reference.from !== currentScope ||
          !reference.isRead()
        ) {
          continue
        }

        propsReferenceIds.add(reference.identifier)
      }
    }

    return compositingVisitors(
      {
        'Program, :function'(
          node:
            | FunctionExpression
            | FunctionDeclaration
            | ArrowFunctionExpression
            | Program
        ) {
          scopeStack = {
            upper: scopeStack,
            scopeNode: node
          }
        },

        'Program, :function:exit'(
          node:
            | FunctionExpression
            | FunctionDeclaration
            | ArrowFunctionExpression
            | Program
        ) {
          scopeStack &&= scopeStack.upper

          setupScopePropsReferenceIds.delete(node)
        },

        CallExpression(node: CallExpression) {
          if (!scopeStack) {
            return
          }

          const propsReferenceIds = setupScopePropsReferenceIds.get(
            scopeStack.scopeNode
          )

          if (!propsReferenceIds) {
            return
          }

          if (isPropsMemberAccessed(node, propsReferenceIds)) {
            report(node, 'getProperty', propsReferenceIds.scopeName)
          }
        },

        VariableDeclarator(node: VariableDeclarator) {
          if (!scopeStack) {
            return
          }
          const propsReferenceIds = setupScopePropsReferenceIds.get(
            scopeStack.scopeNode
          )
          if (!propsReferenceIds) {
            return
          }
          verify(node.id, node.init, propsReferenceIds)
        },

        AssignmentExpression(node: AssignmentExpression) {
          if (!scopeStack) {
            return
          }
          const propsReferenceIds = setupScopePropsReferenceIds.get(
            scopeStack.scopeNode
          )
          if (!propsReferenceIds) {
            return
          }
          verify(node.left, node.right, propsReferenceIds)
        }
      },
      defineScriptSetupVisitor(context, {
        onDefinePropsEnter(node: any) {
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
          if (!target.parent) {
            return
          }

          let id = null
          if (target.parent.type === 'VariableDeclarator') {
            id = target.parent.init === target ? target.parent.id : null
          } else if (target.parent.type === 'AssignmentExpression') {
            id = target.parent.right === target ? target.parent.left : null
          }
          if (!id) return
          const currentScope = getScope(context, node)
          for (const propId of iteratePropIds(id)) {
            processPropId(
              propId,
              context.sourceCode.ast,
              currentScope,
              '<script setup>'
            )
          }
        }
      }),
      defineVueVisitor(context, {
        onSetupFunctionEnter(node: any) {
          const currentScope = getScope(context, node)
          const propsParam = skipDefaultParamValue(node.params[0])
          if (!propsParam) return
          processPropId(
            { node: propsParam, kind: 'props' },
            node,
            currentScope,
            'setup()'
          )
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
