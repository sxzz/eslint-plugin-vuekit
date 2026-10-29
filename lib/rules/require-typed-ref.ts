/**
 * @author Ivan Demchuk <https://github.com/Demivan>
 * See LICENSE file in root directory for full license.
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule
} from '../types/rule.ts'

import type {
  ArrowFunctionExpression,
  CallExpression,
  Expression,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Pattern,
  RuleContext,
  SpreadElement,
  VElement
} from '../types/index.ts'

import { findVariable } from '@eslint-community/eslint-utils'
import { iterateDefineRefs } from '../utils/ref-object-references.ts'
import {
  isVueFile,
  isTypeScriptFile,
  isVElement,
  hasAttribute,
  getScope
} from '../utils/index.ts'

type FunctionNode =
  FunctionDeclaration | FunctionExpression | ArrowFunctionExpression

/** `ref() as Ref<T>`, `ref() satisfies Ref<T>` and `<Ref<T>>ref()` */
const TYPE_ASSERTIONS = new Set([
  'TSAsExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion'
])

function isNullOrUndefined(node: Expression | SpreadElement) {
  return (
    (node.type === 'Literal' && node.value === null) ||
    (node.type === 'Identifier' && node.name === 'undefined')
  )
}

function hasTypeAnnotation(node: Pattern): boolean {
  return node.type === 'AssignmentPattern'
    ? hasTypeAnnotation(node.left)
    : 'typeAnnotation' in node && node.typeAnnotation != null
}

/**
 * Resolves the single definition of the given identifier reference.
 */
function findDefinition(context: RuleContext, node: Identifier) {
  const variable = (findVariable as unknown as WithVue<typeof findVariable>)(
    getScope(context, node),
    node
  )
  return variable?.defs.length === 1 ? variable.defs[0] : null
}

/**
 * Checks whether the given identifier refers to a variable or a parameter
 * that was declared with an explicit type annotation.
 */
function isTypedVariable(context: RuleContext, node: Identifier): boolean {
  const def = findDefinition(context, node)
  return (
    (def?.type === 'Variable' || def?.type === 'Parameter') &&
    hasTypeAnnotation(def.name as Pattern)
  )
}

/**
 * Resolves the identifier to the function it refers to, if that function is
 * declared in the same file.
 */
function findFunction(
  context: RuleContext,
  node: Identifier
): FunctionNode | null {
  const def = findDefinition(context, node)
  if (
    def?.type === 'FunctionName' &&
    (def.node.type === 'FunctionDeclaration' ||
      def.node.type === 'FunctionExpression')
  ) {
    return def.node
  }
  const init = def?.type === 'Variable' ? def.node.init : null
  return init != null &&
    (init.type === 'ArrowFunctionExpression' ||
      init.type === 'FunctionExpression')
    ? init
    : null
}

/**
 * Checks whether the parameter receiving the argument at the given index has
 * an explicit type annotation.
 */
function hasTypedParameter(fn: FunctionNode, index: number): boolean {
  const param = fn.params[index]
  if (param != null) {
    return hasTypeAnnotation(param)
  }

  const lastParam = fn.params.at(-1)
  return lastParam?.type === 'RestElement' && hasTypeAnnotation(lastParam)
}

/**
 * Checks whether an explicit type annotation already applies to the given
 * expression, which makes the type of the created ref known.
 */
function isInTypedPosition(context: RuleContext, node: Expression): boolean {
  const parent = node.parent
  if (TYPE_ASSERTIONS.has(parent.type)) {
    return true
  }
  switch (parent.type) {
    // `const value: Ref<T> = ref()`
    case 'VariableDeclarator': {
      return parent.init === node && hasTypeAnnotation(parent.id)
    }
    // `function useValue(value: Ref<T> = ref()) {}`
    case 'AssignmentPattern': {
      return parent.right === node && hasTypeAnnotation(parent.left)
    }
    // `value = ref()` where `value` is typed
    case 'AssignmentExpression': {
      return (
        parent.operator === '=' &&
        parent.left.type === 'Identifier' &&
        isTypedVariable(context, parent.left)
      )
    }
    // `useValue(ref())` where the parameter of `useValue` is typed
    case 'CallExpression': {
      const index = parent.arguments.indexOf(node)
      if (index === -1 || parent.callee.type !== 'Identifier') {
        return false
      }
      const fn = findFunction(context, parent.callee)
      return fn != null && hasTypedParameter(fn, index)
    }
    default: {
      return false
    }
  }
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'require `ref` and `shallowRef` functions to be strongly typed',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/require-typed-ref.html'
    },
    schema: [],
    messages: {
      noType:
        'Specify type parameter for `{{name}}` function, otherwise created variable will not be typechecked.'
    }
  },
  create(context: RuleContext) {
    const filename = context.filename
    if (!isVueFile(filename) && !isTypeScriptFile(filename)) {
      return {}
    }

    if (isVueFile(filename)) {
      const sourceCode = context.sourceCode
      const documentFragment =
        sourceCode.parserServices.getDocumentFragment &&
        sourceCode.parserServices.getDocumentFragment()
      if (!documentFragment) {
        return {}
      }
      const scripts = documentFragment.children.filter(
        (element): element is VElement =>
          isVElement(element) && element.name === 'script'
      )
      if (scripts.every((script) => !hasAttribute(script, 'lang', 'ts'))) {
        return {}
      }
    }

    const defines = iterateDefineRefs(
      context.sourceCode.scopeManager.globalScope!
    )

    function report(name: string, node: CallExpression) {
      context.report({
        node,
        messageId: 'noType',
        data: {
          name
        }
      })
    }

    return {
      Program() {
        for (const ref of defines) {
          if (ref.name !== 'ref' && ref.name !== 'shallowRef') {
            continue
          }

          if (
            ref.node.arguments.length > 0 &&
            !isNullOrUndefined(ref.node.arguments[0])
          ) {
            continue
          }

          const typeArguments = ref.node.typeArguments
          if (typeArguments != null) {
            continue
          }

          if (!isInTypedPosition(context, ref.node)) {
            report(ref.name, ref.node)
          }
        }
      }
    }
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
