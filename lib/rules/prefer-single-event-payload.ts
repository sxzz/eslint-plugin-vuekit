/**
 * @author Flo Edelmann
 * See LICENSE file in root directory for full license.
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule,
  ReportSourceLocation
} from '../types/rule.ts'

import type {
  CallExpression,
  Identifier,
  ObjectExpression,
  Program,
  RuleContext
} from '../types/index.ts'

import { findVariable } from '@eslint-community/eslint-utils'
import {
  skipChainExpression,
  getStaticPropertyName,
  isStringLiteral,
  getStringLiteralValue,
  defineTemplateBodyVisitor,
  compositingVisitors,
  defineScriptSetupVisitor,
  getScope,
  executeOnVue,
  getComponentEmitsFromOptions,
  defineVueVisitor,
  skipDefaultParamValue,
  findAssignmentProperty
} from '../utils/index.ts'
import type { ComponentEmit, ComponentUnknownEmit } from '../utils'

import type { HasLocation } from '../types/ast.ts'

/**
 * Get the callee member node from the given CallExpression
 */
function getCalleeMemberNode(node: CallExpression) {
  const callee = skipChainExpression(node.callee)

  if (callee.type === 'MemberExpression') {
    const name = getStaticPropertyName(callee)
    if (name) {
      return { name, member: callee }
    }
  }
  return null
}

function getReportLocation(
  parameters: HasLocation[],
  firstReportedIndex: number
): ReportSourceLocation | undefined {
  if (parameters.length < firstReportedIndex + 1) {
    return undefined
  }

  return {
    start: parameters[firstReportedIndex].loc.start,
    end: parameters.at(-1)!.loc.end
  }
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'enforce passing a single argument to custom event emissions',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/prefer-single-event-payload.html'
    },
    hasSuggestions: false,
    schema: [],
    messages: {
      preferSinglePayload:
        'Pass a single payload object instead of multiple arguments when emitting the "{{name}}" event.',
      preferSinglePayloadInDeclaration:
        'Declare a single payload parameter instead of multiple parameters for the "{{name}}" event.'
    }
  },
  create(context: RuleContext) {
    const setupContexts = new Map<
      ObjectExpression | Program,
      {
        contextReferenceIds: Set<Identifier>
        emitReferenceIds: Set<Identifier>
      }
    >()

    function verifyEmitCall(node: CallExpression) {
      // arguments[0] is the event name; if there are more than 2 arguments
      // total there are multiple payload values
      if (node.arguments.length <= 2) {
        return
      }

      const eventNameArg = node.arguments[0]
      const name = isStringLiteral(eventNameArg)
        ? getStringLiteralValue(eventNameArg)
        : null

      context.report({
        node,
        loc: getReportLocation(node.arguments, 2),
        messageId: 'preferSinglePayload',
        data: { name: name ?? 'unknown' }
      })
    }

    function verifyEmitDeclarationNode(
      emit: Exclude<ComponentEmit, ComponentUnknownEmit>,
      parameters: HasLocation[],
      firstReportedIndex = 1
    ) {
      const reportLocation = getReportLocation(parameters, firstReportedIndex)
      if (reportLocation) {
        context.report({
          node: emit.node,
          loc: reportLocation,
          messageId: 'preferSinglePayloadInDeclaration',
          data: { name: emit.emitName ?? 'unknown' }
        })
      }
    }

    function verifyEmitDeclaration(emit: ComponentEmit) {
      if (emit.type === 'object') {
        // Options API: emits: { change: (val1, val2) => true }
        if (
          emit.value.type === 'ArrowFunctionExpression' ||
          emit.value.type === 'FunctionExpression'
        ) {
          verifyEmitDeclarationNode(emit, emit.value.params)
        }
      } else if (emit.type === 'type') {
        switch (emit.node.type) {
          case 'TSCallSignatureDeclaration':
          case 'TSFunctionType': {
            // (e: 'change', val1: string, val2: number): void
            verifyEmitDeclarationNode(emit, emit.node.params, 2)
            break
          }
          case 'TSPropertySignature': {
            // change: [val1: string, val2: number]
            const typeAnno = emit.node.typeAnnotation?.typeAnnotation
            if (typeAnno?.type === 'TSTupleType') {
              verifyEmitDeclarationNode(emit, typeAnno.elementTypes)
            }
            break
          }
          case 'TSMethodSignature': {
            // change(val1: string, val2: number): void
            verifyEmitDeclarationNode(emit, emit.node.params)
            break
          }
          // No default
        }
      }
    }

    return defineTemplateBodyVisitor(
      context,
      {
        CallExpression(node) {
          const callee = skipChainExpression(node.callee)
          const setupContext = setupContexts.get(context.sourceCode.ast)
          const isEmitCall =
            callee.type === 'Identifier' &&
            (callee.name === '$emit' ||
              (setupContext &&
                [...setupContext.emitReferenceIds].some(
                  (id) => id.name === callee.name
                )))
          if (isEmitCall) {
            verifyEmitCall(node)
          }
        }
      },
      compositingVisitors(
        defineScriptSetupVisitor(context, {
          onDefineEmitsEnter(node, emits) {
            for (const emit of emits) {
              verifyEmitDeclaration(emit)
            }

            if (
              !node.parent ||
              node.parent.type !== 'VariableDeclarator' ||
              node.parent.init !== node
            ) {
              return
            }
            const emitParam = node.parent.id
            if (emitParam.type !== 'Identifier') {
              return
            }
            const variable = (
              findVariable as unknown as WithVue<typeof findVariable>
            )(getScope(context, emitParam), emitParam)
            if (!variable) {
              return
            }
            const emitReferenceIds = new Set<Identifier>()
            for (const reference of variable.references) {
              if (
                reference.identifier.type !== 'Identifier' ||
                !reference.isRead()
              ) {
                continue
              }
              emitReferenceIds.add(reference.identifier)
            }
            const programNode = context.sourceCode.ast
            setupContexts.set(programNode, {
              contextReferenceIds: new Set<Identifier>(),
              emitReferenceIds
            })
          },
          CallExpression(node: CallExpression) {
            const callee = skipChainExpression(node.callee)
            const programNode = context.sourceCode.ast
            const setupContext = setupContexts.get(programNode)
            if (
              setupContext &&
              callee.type === 'Identifier' &&
              setupContext.emitReferenceIds.has(callee)
            ) {
              verifyEmitCall(node)
            }
          }
        }),
        executeOnVue(context, (obj) => {
          for (const emit of getComponentEmitsFromOptions(obj)) {
            verifyEmitDeclaration(emit)
          }
        }),
        defineVueVisitor(context, {
          onSetupFunctionEnter(node, { node: vueNode }) {
            const contextParam = skipDefaultParamValue(node.params[1])
            if (
              !contextParam ||
              contextParam.type === 'RestElement' ||
              contextParam.type === 'ArrayPattern'
            ) {
              return
            }
            const contextReferenceIds = new Set<Identifier>()
            const emitReferenceIds = new Set<Identifier>()
            if (contextParam.type === 'ObjectPattern') {
              const emitProperty = findAssignmentProperty(contextParam, 'emit')
              if (!emitProperty || emitProperty.value.type !== 'Identifier') {
                return
              }
              const emitParam = emitProperty.value
              const variable = (
                findVariable as unknown as WithVue<typeof findVariable>
              )(getScope(context, emitParam), emitParam)
              if (!variable) {
                return
              }
              for (const reference of variable.references) {
                if (reference.identifier.type !== 'Identifier') continue
                emitReferenceIds.add(reference.identifier)
              }
            } else {
              if (contextParam.type !== 'Identifier') return
              const variable = (
                findVariable as unknown as WithVue<typeof findVariable>
              )(getScope(context, contextParam), contextParam)
              if (!variable) {
                return
              }
              for (const reference of variable.references) {
                if (reference.identifier.type !== 'Identifier') continue
                contextReferenceIds.add(reference.identifier)
              }
            }
            setupContexts.set(vueNode, {
              contextReferenceIds,
              emitReferenceIds
            })
          },
          CallExpression(node, { node: vueNode }) {
            const callee = skipChainExpression(node.callee)
            const setupContext = setupContexts.get(vueNode)
            if (!setupContext) {
              return
            }

            const { contextReferenceIds, emitReferenceIds } = setupContext
            if (callee.type === 'Identifier' && emitReferenceIds.has(callee)) {
              // setup(props, {emit}) { emit() }
              verifyEmitCall(node)
            } else {
              const emit = getCalleeMemberNode(node)
              if (
                emit &&
                emit.name === 'emit' &&
                emit.member.object.type === 'Identifier' &&
                contextReferenceIds.has(emit.member.object)
              ) {
                // setup(props, context) { context.emit() }
                verifyEmitCall(node)
              }
            }
          },
          onVueObjectExit(node) {
            setupContexts.delete(node)
          }
        }),
        {
          CallExpression(node: CallExpression) {
            const emit = getCalleeMemberNode(node)
            if (emit && emit.name === '$emit') {
              // this.$emit()
              verifyEmitCall(node)
            }
          }
        }
      )
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
