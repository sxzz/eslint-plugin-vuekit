/**
 * @author Wayne Zhang
 * See LICENSE file in root directory for full license.
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule
} from '../types/rule.ts'

import type { Identifier, Program, RuleContext } from '../types/index.ts'

import {
  isThis,
  compositingVisitors,
  defineVueVisitor,
  defineScriptSetupVisitor,
  getScope
} from '../utils/index.ts'
import { ReferenceTracker } from '@eslint-community/eslint-utils'

export type TraceMap =
  import('@eslint-community/eslint-utils').TraceMap<unknown>

const deletedImportApisMap = {
  set: {
    [ReferenceTracker.CALL]: true
  },
  del: {
    [ReferenceTracker.CALL]: true
  }
}
const deprecatedDollarApis = new Set(['$set', '$delete'])

function getVueDeprecatedCallExpression(
  identifier: Identifier,
  context: RuleContext
) {
  // Instance API: this.$set()
  return deprecatedDollarApis.has(identifier.name) &&
    identifier.parent.type === 'MemberExpression' &&
    isThis(identifier.parent.object, context) &&
    identifier.parent.parent.type === 'CallExpression' &&
    identifier.parent.parent.callee === identifier.parent
    ? identifier.parent.parent
    : undefined
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'disallow using deprecated `$delete` and `$set` (in Vue.js 3.0.0+)',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-deprecated-delete-set.html'
    },
    schema: [],
    messages: {
      deprecated: 'The `$delete`, `$set` is deprecated.'
    }
  },

  create(context: RuleContext) {
    const nodeVisitor = {
      Identifier(node: Identifier) {
        const callExpression = getVueDeprecatedCallExpression(node, context)
        if (!callExpression) {
          return
        }

        context.report({
          node,
          messageId: 'deprecated'
        })
      }
    }

    return compositingVisitors(
      defineVueVisitor(context, nodeVisitor),
      defineScriptSetupVisitor(context, nodeVisitor),
      {
        Program(node: Program) {
          const tracker = new ReferenceTracker(
            getScope(context, node) as unknown as ConstructorParameters<
              typeof ReferenceTracker
            >[0]
          )

          // import { set } from 'vue'; set()
          const esmTraceMap: TraceMap = {
            vue: {
              [ReferenceTracker.ESM]: true,
              ...deletedImportApisMap
            }
          }
          // const { set } = require('vue'); set()
          const cjsTraceMap = {
            vue: {
              ...deletedImportApisMap
            }
          }

          for (const { node } of [
            ...(tracker.iterateEsmReferences(esmTraceMap) as unknown as WithVue<
              ReturnType<typeof tracker.iterateEsmReferences>
            >),
            ...(tracker.iterateCjsReferences(
              cjsTraceMap as unknown as TraceMap
            ) as unknown as WithVue<
              ReturnType<typeof tracker.iterateCjsReferences>
            >)
          ]) {
            if (node.type !== 'CallExpression') continue
            const refNode = node
            context.report({
              node: refNode.callee,
              messageId: 'deprecated'
            })
          }
        }
      }
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
