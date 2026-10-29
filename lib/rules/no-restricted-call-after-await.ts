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
  AwaitExpression,
  CallExpression,
  FunctionDeclaration,
  FunctionExpression,
  Program,
  RuleContext
} from '../types/index.ts'

import fs from 'node:fs'
import path from 'node:path'
import { ReferenceTracker } from '@eslint-community/eslint-utils'
import {
  compositingVisitors,
  getScope,
  defineVueVisitor,
  isInRange
} from '../utils/index.ts'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

export type TraceMap =
  import('@eslint-community/eslint-utils').TraceMap<unknown>
export type TraceKind =
  import('@eslint-community/eslint-utils').TraceMap<unknown>[string]

function safeRequireResolve(id: string) {
  try {
    if (fs.statSync(id).isDirectory()) {
      return require.resolve(id)
    }
  } catch {
    // ignore
  }
  return id
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow asynchronously called restricted methods',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-restricted-call-after-await.html'
    },
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          module: { type: 'string' },
          path: {
            oneOf: [
              { type: 'string' },
              {
                type: 'array',
                items: {
                  type: 'string'
                }
              }
            ]
          },
          message: { type: 'string', minLength: 1 }
        },
        required: ['module'],
        additionalProperties: false
      },
      uniqueItems: true,
      minItems: 0
    },
    messages: {
      restricted: '{{message}}'
    }
  },

  create(context: RuleContext) {
    const restrictedCallNodes = new Map()

    const setupScopes = new Map()
    type ScopeStack = {
      upper: ScopeStack | null
      scopeNode:
        FunctionExpression | ArrowFunctionExpression | FunctionDeclaration
    }

    let scopeStack: ScopeStack | null = null

    let allLocalImports: Record<string, string[]> | null = null

    function getAllLocalImports(ast: Program) {
      if (!allLocalImports) {
        allLocalImports = {}
        const dir = path.dirname(context.filename)
        for (const body of ast.body) {
          if (body.type !== 'ImportDeclaration') {
            continue
          }
          const source = String(body.source.value)
          if (!source.startsWith('.')) {
            continue
          }
          const modulePath = safeRequireResolve(path.join(dir, source))
          allLocalImports[modulePath] ||= []
          allLocalImports[modulePath].push(source)
        }
      }

      return allLocalImports
    }

    function normalizeModules(moduleName: string, ast: Program) {
      let modulePath
      if (moduleName.startsWith('.')) {
        modulePath = safeRequireResolve(path.join(context.cwd, moduleName))
      } else if (path.isAbsolute(moduleName)) {
        modulePath = safeRequireResolve(moduleName)
      } else {
        return [moduleName]
      }
      return getAllLocalImports(ast)[modulePath] || []
    }

    return compositingVisitors(
      {
        Program(node: Program) {
          const tracker = new ReferenceTracker(
            getScope(context, node) as unknown as ConstructorParameters<
              typeof ReferenceTracker
            >[0]
          )

          for (const option of context.options) {
            const modules = normalizeModules(option.module, node)

            for (const module of modules) {
              const traceMap: Record<string, Record<PropertyKey, any>> = {
                [module]: {
                  [ReferenceTracker.ESM]: true
                }
              }

              const mod = traceMap[module]
              let local = mod
              const paths = Array.isArray(option.path)
                ? option.path
                : [option.path || 'default']
              for (const path of paths) {
                local[path] ||= {}
                local = local[path]
              }
              local[ReferenceTracker.CALL] = true
              const message =
                option.message ||
                `\`${[`import("${module}")`, ...paths].join(
                  '.'
                )}\` is forbidden after an \`await\` expression.`

              for (const { node } of tracker.iterateEsmReferences(
                traceMap
              ) as unknown as WithVue<
                ReturnType<typeof tracker.iterateEsmReferences>
              >) {
                restrictedCallNodes.set(node, message)
              }
            }
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

          const message = restrictedCallNodes.get(node)
          if (message) {
            context.report({
              node,
              messageId: 'restricted',
              data: { message }
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
