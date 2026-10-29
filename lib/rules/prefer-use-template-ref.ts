/**
 * @author Thomasan1999
 * See LICENSE file in root directory for full license.
 */
import type {
  CallExpression,
  ModuleDeclaration,
  RuleContext,
  Statement
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  compositingVisitors,
  defineTemplateBodyVisitor,
  defineVueVisitor,
  defineScriptSetupVisitor
} from '../utils/index.ts'

export type ScriptRef = [string, CallExpression]

function getScriptRefsFromSetupFunction(
  body: (Statement | ModuleDeclaration)[]
): ScriptRef[] {
  return body.flatMap((child: any) => {
    if (child.type === 'VariableDeclaration') {
      const declarator = child.declarations[0]

      if (
        declarator.init?.type === 'CallExpression' &&
        declarator.init.callee?.type === 'Identifier' &&
        declarator.id.type === 'Identifier' &&
        ['ref', 'shallowRef'].includes(declarator.init.callee.name)
      )
        return [[declarator.id.name, declarator.init] as ScriptRef]
    }

    return []
  })
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'require using `useTemplateRef` instead of `ref`/`shallowRef` for template refs',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/prefer-use-template-ref.html'
    },
    schema: [],
    messages: {
      preferUseTemplateRef: "Replace '{{name}}' with 'useTemplateRef'."
    }
  },

  create(context: RuleContext) {
    const templateRefs = new Set()

    const scriptRefs: ScriptRef[] = []

    return compositingVisitors(
      defineTemplateBodyVisitor(context, {
        'VAttribute[directive=false]'(node: any) {
          if (node.key.name === 'ref' && node.value?.value) {
            templateRefs.add(node.value.value)
          }
        }
      }),
      defineVueVisitor(context, {
        onSetupFunctionEnter(node: any) {
          if (node.type === 'ArrowFunctionExpression' && node.expression) {
            return
          }
          const newScriptRefs = getScriptRefsFromSetupFunction(node.body.body)
          scriptRefs.push(...newScriptRefs)
        }
      }),
      defineScriptSetupVisitor(context, {
        Program(node: any) {
          const newScriptRefs = getScriptRefsFromSetupFunction(node.body)

          scriptRefs.push(...newScriptRefs)
        }
      }),
      {
        'Program:exit'() {
          const scriptRefsMap: any = new Map(scriptRefs)

          for (const templateRef of templateRefs) {
            const scriptRef = scriptRefsMap.get(templateRef)

            if (!scriptRef) {
              continue
            }

            context.report({
              node: scriptRef,
              messageId: 'preferUseTemplateRef',
              data: {
                name: scriptRef.callee.name
              }
            })
          }
        }
      }
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
