/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  ArrowFunctionExpression,
  AwaitExpression,
  CallExpression,
  ChainExpression,
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

function isMaybeUsedStopHandle(node: CallExpression | ChainExpression) {
  const parent = node.parent
  if (parent) {
    switch (parent.type) {
      case 'VariableDeclarator': {
        // var foo = watch()
        return true
      }
      case 'AssignmentExpression': {
        // foo = watch()
        return true
      }
      case 'CallExpression': {
        // foo(watch())
        return true
      }
      case 'Property': {
        // {foo: watch()}
        return true
      }
      case 'ArrayExpression': {
        // [watch()]
        return true
      }
      case 'ChainExpression': {
        return isMaybeUsedStopHandle(parent)
      }
    }
  }
  return false
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow asynchronously registered `watch`',
      categories: ['vue3-essential'],
      url: 'https://eslint.vuejs.org/rules/no-watch-after-await.html'
    },
    schema: [],
    messages: {
      forbidden: '`watch` is forbidden after an `await` expression.'
    }
  },

  create(context: RuleContext) {
    const watchCallNodes = new Set()

    const setupScopes = new Map()
    type ScopeStack = {
      upper: ScopeStack | null
      scopeNode:
        FunctionExpression | ArrowFunctionExpression | FunctionDeclaration
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

          const watchRefs = iterateReferencesTraceMap(tracker, {
            watch: {
              [ReferenceTracker.CALL]: true
            },
            watchEffect: {
              [ReferenceTracker.CALL]: true
            }
          })
          for (const { node } of watchRefs) {
            watchCallNodes.add(node)
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
            FunctionExpression | ArrowFunctionExpression | FunctionDeclaration
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
            !setupScope ||
            !setupScope.afterAwait ||
            !isInRange(setupScope.range, node)
          ) {
            return
          }

          if (watchCallNodes.has(node) && !isMaybeUsedStopHandle(node)) {
            context.report({
              node,
              messageId: 'forbidden'
            })
          }
        },
        onSetupFunctionExit(node: any) {
          setupScopes.delete(node)
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
