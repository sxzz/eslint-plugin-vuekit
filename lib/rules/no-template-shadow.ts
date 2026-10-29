/**
 * @fileoverview Disallow variable declarations from shadowing variables declared in the outer scope.
 * @author Armano
 */
import type { Identifier, RuleContext, VElement } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  compositingVisitors,
  isScriptSetup,
  defineScriptSetupVisitor,
  executeOnVue,
  iterateProperties,
  defineTemplateBodyVisitor
} from '../utils/index.ts'

export type GroupName = import('../utils').GroupName

const GROUP_NAMES: GroupName[] = [
  'props',
  'computed',
  'data',
  'asyncData',
  'methods',
  'setup'
]

function isAllowedVarName(context: RuleContext, variableName: string) {
  return context.options[0] && context.options[0].allow
    ? context.options[0].allow.includes(variableName)
    : false
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'disallow variable declarations from shadowing variables declared in the outer scope',
      categories: ['vue3-strongly-recommended'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-template-shadow.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          allow: {
            type: 'array',
            items: {
              type: 'string'
            },
            uniqueItems: true
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      alreadyDeclaredInUpperScope:
        "Variable '{{name}}' is already declared in the upper scope."
    }
  },

  create(context: RuleContext) {
    const jsVars = new Set()
    type ScopeStack = {
      parent: ScopeStack | null
      nodes: Identifier[]
    }

    let scopeStack: ScopeStack | null = null

    return compositingVisitors(
      isScriptSetup(context)
        ? {
            Program() {
              const globalScope = context.sourceCode.scopeManager.globalScope
              if (!globalScope) {
                return
              }
              for (const variable of globalScope.variables) {
                if (variable.defs.length > 0) {
                  jsVars.add(variable.name)
                }
              }
              const moduleScope = globalScope.childScopes.find(
                (scope: any) => scope.type === 'module'
              )
              if (!moduleScope) {
                return
              }
              for (const variable of moduleScope.variables) {
                if (variable.defs.length > 0) {
                  jsVars.add(variable.name)
                }
              }
            }
          }
        : {},
      defineScriptSetupVisitor(context, {
        onDefinePropsEnter(_node: any, props: any) {
          for (const prop of props) {
            if (prop.propName) {
              jsVars.add(prop.propName)
            }
          }
        }
      }),
      executeOnVue(context, (obj: any) => {
        const properties = iterateProperties(obj, new Set(GROUP_NAMES))
        for (const node of properties) {
          jsVars.add(node.name)
        }
      }),
      defineTemplateBodyVisitor(context, {
        VElement(node: VElement) {
          scopeStack = {
            parent: scopeStack,
            nodes: scopeStack ? [...scopeStack.nodes] : []
          }
          for (const variable of node.variables) {
            const varNode = variable.id
            const name = varNode.name

            if (isAllowedVarName(context, name)) {
              continue
            }

            if (
              scopeStack.nodes.some((node) => node.name === name) ||
              jsVars.has(name)
            ) {
              context.report({
                node: varNode,
                loc: varNode.loc,
                messageId: 'alreadyDeclaredInUpperScope',
                data: {
                  name
                }
              })
            } else {
              scopeStack.nodes.push(varNode)
            }
          }
        },
        'VElement:exit'() {
          scopeStack &&= scopeStack.parent
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
