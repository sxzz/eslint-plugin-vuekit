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
  ChainExpression,
  Expression,
  Identifier,
  MemberExpression,
  RuleContext
} from '../types/index.ts'

import {
  getScope,
  defineVueVisitor,
  skipChainExpression,
  getStaticPropertyName,
  isThis
} from '../utils/index.ts'
import { findVariable } from '@eslint-community/eslint-utils'

// Parent node types where a `$slots` property is used as a value rather than called.
const SLOT_USED_AS_VALUE_PARENT_TYPES = new Set([
  'MemberExpression', // this.$slots.foo.xxx
  'VariableDeclarator', // var [foo] = this.$slots.foo
  'SpreadElement', // [...this.$slots.foo]
  'ArrayExpression' // [this.$slots.foo]
])

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'enforce properties of `$slots` to be used as a function',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/require-slots-as-functions.html'
    },
    schema: [],
    messages: {
      unexpected: 'Property in `$slots` should be used as function.'
    }
  },

  create(context: RuleContext) {
    /**
     * Verify the given node
     */
    function verify(
      node: MemberExpression | Identifier | ChainExpression,
      reportNode: Expression
    ) {
      const parent = node.parent

      if (
        parent.type === 'VariableDeclarator' &&
        parent.id.type === 'Identifier'
      ) {
        // const children = this.$slots.foo
        verifyReferences(parent.id, reportNode)
        return
      }

      if (
        parent.type === 'AssignmentExpression' &&
        parent.right === node &&
        parent.left.type === 'Identifier'
      ) {
        // children = this.$slots.foo
        verifyReferences(parent.left, reportNode)
        return
      }

      if (parent.type === 'ChainExpression') {
        // (this.$slots?.foo).x
        verify(parent, reportNode)
        return
      }

      if (SLOT_USED_AS_VALUE_PARENT_TYPES.has(parent.type)) {
        context.report({
          node: reportNode,
          messageId: 'unexpected'
        })
      }
    }
    /**
     * Verify the references of the given node.
     */
    function verifyReferences(node: Identifier, reportNode: Expression) {
      const variable = (
        findVariable as unknown as WithVue<typeof findVariable>
      )(getScope(context, node), node)
      if (!variable) {
        return
      }
      for (const reference of variable.references) {
        if (reference.identifier.type !== 'Identifier' || !reference.isRead()) {
          continue
        }

        const id = reference.identifier
        verify(id, reportNode)
      }
    }

    return defineVueVisitor(context, {
      MemberExpression(node: MemberExpression) {
        const object = skipChainExpression(node.object)
        if (
          object.type !== 'MemberExpression' ||
          getStaticPropertyName(object) !== '$slots' ||
          !isThis(object.object, context) ||
          node.property.type === 'PrivateIdentifier' // Unreachable
        ) {
          return
        }
        verify(node, node.property)
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
