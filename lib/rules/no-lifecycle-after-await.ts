/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  ArrowFunctionExpression,
  AwaitExpression,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  Program,
  RuleContext
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { ReferenceTracker } from '@eslint-community/eslint-utils'
import {
  compositingVisitors,
  getScope,
  iterateReferencesTraceMap,
  defineVueVisitor,
  isInRange
} from '../utils/index.ts'

export type TraceMap =
  import('@eslint-community/eslint-utils').TraceMap<unknown>

const LIFECYCLE_HOOKS = [
  'onBeforeMount',
  'onBeforeUnmount',
  'onBeforeUpdate',
  'onErrorCaptured',
  'onMounted',
  'onRenderTracked',
  'onRenderTriggered',
  'onUnmounted',
  'onUpdated',
  'onActivated',
  'onDeactivated'
]

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow asynchronously registered lifecycle hooks',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/no-lifecycle-after-await.html'
    },
    schema: [],
    messages: {
      forbidden: 'Lifecycle hooks are forbidden after an `await` expression.'
    }
  },

  create(context: RuleContext) {
    const lifecycleHookCallNodes = new Set()

    const setupScopes = new Map()

    type ScopeStack = {
      upper: ScopeStack | null
      scopeNode:
        FunctionDeclaration | FunctionExpression | ArrowFunctionExpression
    }

    let scopeStack: ScopeStack | null = null

    return compositingVisitors(
      {
        Program(program: Program) {
          const tracker = new ReferenceTracker(
            getScope(context, program) as unknown as ConstructorParameters<
              typeof ReferenceTracker
            >[0]
          )

          const traceMap: Record<string, Record<symbol, boolean>> = {}
          for (const lifecycleHook of LIFECYCLE_HOOKS) {
            traceMap[lifecycleHook] = {
              [ReferenceTracker.CALL]: true
            }
          }

          for (const { node } of iterateReferencesTraceMap(tracker, traceMap)) {
            lifecycleHookCallNodes.add(node)
          }
        }
      },
      defineVueVisitor(context, {
        onSetupFunctionEnter(node: any) {
          setupScopes.set(node, {
            afterAwait: false,
            range: node.range
          })
        },

        ':function'(
          node:
            FunctionExpression | FunctionDeclaration | ArrowFunctionExpression
        ) {
          scopeStack = {
            upper: scopeStack,
            scopeNode: node
          }
        },
        ':function:exit'() {
          scopeStack &&= scopeStack.upper
        },

        AwaitExpression(node: AwaitExpression) {
          if (!scopeStack) {
            return
          }
          const setupScope = setupScopes.get(scopeStack.scopeNode)
          if (!setupScope || !isInRange(setupScope.range, node)) {
            return
          }
          setupScope.afterAwait = true
        },

        CallExpression(node: CallExpression) {
          if (!scopeStack) {
            return
          }
          const setupScope = setupScopes.get(scopeStack.scopeNode)
          if (
            !setupScope?.afterAwait ||
            !isInRange(setupScope.range, node) ||
            !lifecycleHookCallNodes.has(node) ||
            node.arguments.length >= 2 // Has target instance. e.g. `onMounted(() => {}, instance)`
          ) {
            return
          }
          context.report({
            node,
            messageId: 'forbidden'
          })
        },
        onSetupFunctionExit(node: any) {
          setupScopes.delete(node)
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
