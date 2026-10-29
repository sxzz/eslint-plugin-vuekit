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

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'disallow passing multiple arguments to scoped slots',
      categories: ['vue3-recommended'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-multiple-slot-args.html'
    },
    schema: [],
    messages: {
      unexpected: 'Unexpected multiple arguments.',
      unexpectedSpread: 'Unexpected spread argument.'
    }
  },

  create(context: RuleContext) {
    /**
     * Verify the given node
     */
    function verify(node: MemberExpression | Identifier) {
      const parent = node.parent

      if (
        parent.type === 'VariableDeclarator' &&
        parent.id.type === 'Identifier'
      ) {
        // const foo = this.$scopedSlots.foo
        verifyReferences(parent.id)
        return
      }

      if (
        parent.type === 'AssignmentExpression' &&
        parent.right === node &&
        parent.left.type === 'Identifier'
      ) {
        // foo = this.$scopedSlots.foo
        verifyReferences(parent.left)
        return
      }

      if (
        parent.type !== 'CallExpression' ||
        parent.arguments.includes(node) ||
        parent.arguments.length === 0
      ) {
        return
      }
      if (parent.arguments.length > 1) {
        context.report({
          node: parent.arguments[1],
          messageId: 'unexpected'
        })
      }
      if (parent.arguments[0].type === 'SpreadElement') {
        context.report({
          node: parent.arguments[0],
          messageId: 'unexpectedSpread'
        })
      }
    }
    /**
     * Verify the references of the given node.
     */
    function verifyReferences(node: Identifier) {
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
        verify(id)
      }
    }

    return defineVueVisitor(context, {
      MemberExpression(node: MemberExpression) {
        const object = skipChainExpression(node.object)
        if (object.type !== 'MemberExpression') {
          return
        }
        const name = getStaticPropertyName(object)
        if (!name || (name !== '$slots' && name !== '$scopedSlots')) {
          return
        }
        if (!isThis(object.object, context)) {
          return
        }
        verify(node)
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
