/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type {
  WithVue,
  RuleDefinition,
  PublicRuleModule
} from '../types/rule.ts'

import type {
  ASTNode,
  ArrayExpression,
  ArrowFunctionExpression,
  AssignmentPattern,
  AssignmentProperty,
  BlockStatement,
  CallExpression,
  ChainExpression,
  ESNode,
  Expression,
  ExpressionStatement,
  FunctionDeclaration,
  FunctionExpression,
  Identifier,
  Literal,
  MemberExpression,
  MethodDefinition,
  NewExpression,
  ObjectExpression,
  ObjectPattern,
  ParserServices,
  Pattern,
  Program,
  Property,
  Range,
  RestElement,
  ReturnStatement,
  RuleContext,
  RuleListener,
  SourceCode,
  SpreadElement,
  SwitchStatement,
  TSAsExpression,
  TemplateListener,
  TemplateLiteral,
  Token,
  VAttribute,
  VDirective,
  VElement,
  VExpressionContainer,
  VStartTag,
  VariableDeclarator
} from '../types/index.ts'

import { getScope } from './scope.ts'
export { getScope } from './scope.ts'
import { vue3BuiltinComponents } from './vue3-builtin-components.ts'
import { vueBuiltinElements } from './vue-builtin-elements.ts'
import { createRequire } from 'node:module'
import path from 'node:path'
import { builtinRules } from 'eslint/use-at-your-own-risk'
import { traverseNodes, getFallbackKeys, NS } from './ast.ts'
import { findVariable, ReferenceTracker } from '@eslint-community/eslint-utils'
import {
  getComponentPropsFromTypeDefine,
  getComponentEmitsFromTypeDefine,
  getComponentSlotsFromTypeDefine,
  isExhaustiveSwitch,
  isTypeNode
} from './ts-utils/index.ts'
import htmlElements from './html-elements.json' with { type: 'json' }
import svgElements from './svg-elements.json' with { type: 'json' }
import mathElements from './math-elements.json' with { type: 'json' }
import voidElements from './void-elements.json' with { type: 'json' }
const require = createRequire(import.meta.url)

export type RuleModule = import('../types/rule.ts').Rule.RuleModule
export type Position = import('estree').Position
export type CodePath = import('eslint').Rule.CodePath
export type CodePathSegment = import('eslint').Rule.CodePathSegment

export type ComponentArrayProp = import('./types.ts').ComponentArrayProp
export type ComponentObjectProp = import('./types.ts').ComponentObjectProp
export type ComponentTypeProp = import('./types.ts').ComponentTypeProp
export type ComponentInferTypeProp = import('./types.ts').ComponentInferTypeProp
export type ComponentUnknownProp = import('./types.ts').ComponentUnknownProp
export type ComponentProp = import('./types.ts').ComponentProp
export type ComponentArrayEmit = import('./types.ts').ComponentArrayEmit
export type ComponentObjectEmit = import('./types.ts').ComponentObjectEmit
export type ComponentTypeEmit = import('./types.ts').ComponentTypeEmit
export type ComponentInferTypeEmit = import('./types.ts').ComponentInferTypeEmit
export type ComponentUnknownEmit = import('./types.ts').ComponentUnknownEmit
export type ComponentEmit = import('./types.ts').ComponentEmit
export type NameWithLoc = import('./types.ts').NameWithLoc
export type ComponentTypeSlot = import('./types.ts').ComponentTypeSlot
export type ComponentInferTypeSlot = import('./types.ts').ComponentInferTypeSlot
export type ComponentUnknownSlot = import('./types.ts').ComponentUnknownSlot
export type ComponentSlot = import('./types.ts').ComponentSlot
export type ComponentModelName = import('./types.ts').ComponentModelName
export type ComponentModel = import('./types.ts').ComponentModel

export type ComponentComputedProperty = {
  key: string | null
  value: BlockStatement | null
}

export type GroupName =
  | 'props'
  | 'asyncData'
  | 'data'
  | 'computed'
  | 'setup'
  | 'watch'
  | 'methods'
  | 'provide'
  | 'inject'
  | 'expose'
export type ComponentArrayPropertyData = {
  type: 'array'
  name: string
  groupName: GroupName
  node: Literal | TemplateLiteral
}
export type ComponentObjectPropertyData = {
  type: 'object'
  name: string
  groupName: GroupName
  node: Identifier | Literal | TemplateLiteral
  property: Property
}
export type ComponentPropertyData =
  ComponentArrayPropertyData | ComponentObjectPropertyData

export type VueObjectType = import('./types.ts').VueObjectType
export type VueObjectData = import('./types.ts').VueObjectData
export type VueVisitor = import('./types.ts').VueVisitor
export type ScriptSetupVisitor = import('./types.ts').ScriptSetupVisitor

// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------

const HTML_ELEMENT_NAMES = new Set(htmlElements)
const SVG_ELEMENT_NAMES = new Set(svgElements)
const MATH_ELEMENT_NAMES = new Set(mathElements)
const VOID_ELEMENT_NAMES = new Set(voidElements)
export const VUE3_BUILTIN_COMPONENT_NAMES = new Set(vue3BuiltinComponents)
const VUE_BUILTIN_ELEMENT_NAMES = new Set(vueBuiltinElements)
const BUILTIN_DIRECTIVE_NAMES = new Set([
  'bind',
  'on',
  'text',
  'html',
  'show',
  'if',
  'else',
  'else-if',
  'for',
  'model',
  'slot',
  'pre',
  'cloak',
  'once',
  'memo',
  'is'
])

const componentComments = new WeakMap()

const stylisticRuleMap = new Map<string, RuleModule>()
/**
 * Get the core rule implementation from the rule name
 */
export function getCoreRule(name: string): PublicRuleModule | null {
  return (
    (builtinRules.get(name) as unknown as PublicRuleModule | undefined) || null
  )
}
/**
 * Get the ESLint Stylistic rule implementation from the rule name.
 */
function getStylisticRule(name: string): RuleModule | null {
  const cached = stylisticRuleMap.get(name)
  if (cached) return cached

  try {
    const plugin = createRequire(`${process.cwd()}/__placeholder__.js`)(
      '@stylistic/eslint-plugin'
    )
    const rule = plugin?.rules?.[name] as RuleModule | undefined
    if (rule) stylisticRuleMap.set(name, rule)
    return rule || null
  } catch {
    return null
  }
}

function newProxy<T extends object>(target: T, ...propsArray: Partial<T>[]) {
  const result = new Proxy(
    {},
    {
      get(_object, key) {
        for (const props of propsArray) {
          if (key in props) {
            // @ts-expect-error -- dynamic AST shape or visitor key
            return props[key]
          }
        }
        // @ts-expect-error -- dynamic AST shape or visitor key
        return target[key]
      },

      has(_object, key) {
        return key in target
      },
      ownKeys(_object) {
        return Reflect.ownKeys(target)
      },
      getPrototypeOf(_object) {
        return Reflect.getPrototypeOf(target)
      }
    }
  )
  return result
}

/**
 * Wrap the rule context object to override methods which access to tokens (such as getTokenAfter).
 */
function wrapContextToOverrideTokenMethods(
  context: RuleContext,
  tokenStore: ParserServices.TokenStore,
  options: any
) {
  const eslintSourceCode = context.sourceCode
  const rootNode = options.applyDocument
    ? eslintSourceCode.parserServices.getDocumentFragment &&
      eslintSourceCode.parserServices.getDocumentFragment()
    : eslintSourceCode.ast.templateBody

  let tokensAndComments: Token[] | null = null
  function getTokensAndComments() {
    if (tokensAndComments) {
      return tokensAndComments
    }
    tokensAndComments = rootNode
      ? tokenStore.getTokens(rootNode, {
          includeComments: true
        })
      : []
    return tokensAndComments
  }

  function getNodeByRangeIndex(index: number) {
    if (!rootNode) {
      return eslintSourceCode.ast
    }

    let result: ASTNode = eslintSourceCode.ast

    const skipNodes: ASTNode[] = []
    let shouldBreak = false

    traverseNodes(rootNode, {
      enterNode(node, parent) {
        if (shouldBreak) {
          return
        }
        if (skipNodes[0] === parent) {
          skipNodes.unshift(node)
          return
        }
        if (node.range[0] <= index && index < node.range[1]) {
          result = node
        } else {
          skipNodes.unshift(node)
        }
      },
      leaveNode(node) {
        if (shouldBreak) {
          return
        }
        if (result === node) {
          shouldBreak = true
        } else if (skipNodes[0] === node) {
          skipNodes.shift()
        }
      }
    })
    return result
  }
  const sourceCode = newProxy(
    eslintSourceCode,
    {
      get tokensAndComments() {
        return getTokensAndComments()
      },
      getNodeByRangeIndex,
      getDeclaredVariables
    },
    tokenStore
  )

  const containerScopes = new WeakMap()

  function getContainerScope(node: ASTNode) {
    const exprContainer = getVExpressionContainer(node)
    if (!exprContainer) {
      return null
    }
    const cache = containerScopes.get(exprContainer)
    if (cache) {
      return cache
    }
    const programNode = eslintSourceCode.ast
    const parserOptions = context.languageOptions?.parserOptions ?? {}
    const ecmaFeatures = parserOptions.ecmaFeatures || {}
    const ecmaVersion =
      context.languageOptions?.ecmaVersion ?? parserOptions.ecmaVersion ?? 2020
    const sourceType = programNode.sourceType
    try {
      const eslintScope = createRequire(require.resolve('eslint'))(
        'eslint-scope'
      )
      const expStmt = newProxy(exprContainer, {
        // @ts-expect-error -- dynamic AST shape or visitor key
        type: 'ExpressionStatement'
      })
      const scopeProgram = newProxy(programNode, {
        // @ts-expect-error -- dynamic AST shape or visitor key
        body: [expStmt]
      })
      const scope = eslintScope.analyze(scopeProgram, {
        ignoreEval: true,
        nodejsScope: false,
        impliedStrict: ecmaFeatures.impliedStrict,
        ecmaVersion,
        sourceType,
        fallback: getFallbackKeys
      })
      containerScopes.set(exprContainer, scope)
      return scope
    } catch {
      // ignore
      // console.log(error)
    }

    return null
  }
  return newProxy(context, {
    get sourceCode() {
      return sourceCode as SourceCode
    }
  })

  function getDeclaredVariables(node: ESNode) {
    const scope = getContainerScope(node)
    return scope?.getDeclaredVariables(node) ?? []
  }
}

/**
 * Wrap the rule context object to override report method to skip the dynamic argument.
 */
function wrapContextToOverrideReportMethodToSkipDynamicArgument(
  context: RuleContext
) {
  const sourceCode = context.sourceCode
  const templateBody = sourceCode.ast.templateBody
  if (!templateBody) {
    return context
  }

  const directiveKeyRanges: Range[] = []
  traverseNodes(templateBody, {
    enterNode(node, parent) {
      if (
        parent &&
        parent.type === 'VDirectiveKey' &&
        node.type === 'VExpressionContainer'
      ) {
        directiveKeyRanges.push(node.range)
      }
    },
    leaveNode() {}
  })

  return newProxy(context, {
    report(descriptor: any, ...args: any[]) {
      let range = null
      if (descriptor.loc) {
        const startLoc = descriptor.loc.start || descriptor.loc
        const endLoc = descriptor.loc.end || startLoc
        range = [
          sourceCode.getIndexFromLoc(startLoc),
          sourceCode.getIndexFromLoc(endLoc)
        ]
      } else if (descriptor.node) {
        range = descriptor.node.range
      }
      if (range) {
        for (const directiveKeyRange of directiveKeyRanges) {
          if (
            range[0] < directiveKeyRange[1] &&
            directiveKeyRange[0] < range[1]
          ) {
            return
          }
        }
      }
      Reflect.apply(context.report, context, [descriptor, ...args])
    }
  })
}

export type WrapRuleCreateContext = { baseHandlers: RuleListener }
export type WrapRuleCreate = (
  ruleContext: RuleContext,
  wrapContext: WrapRuleCreateContext
) => TemplateListener

export type WrapRulePreprocessContext = {
  wrapContextToOverrideProperties: (
    override: Partial<RuleContext>
  ) => RuleContext
  defineVisitor: (visitor: TemplateListener) => void
}
export type WrapRulePreprocess = (
  ruleContext: RuleContext,
  wrapContext: WrapRulePreprocessContext
) => void

export type WrapRuleOptions = {
  categories?: string[]
  skipDynamicArguments?: boolean
  skipDynamicArgumentsReport?: boolean
  applyDocument?: boolean
  skipBaseHandlers?: boolean
  preprocess?: WrapRulePreprocess
  create?: WrapRuleCreate
}
/**
 * Wrap a given core rule to apply it to Vue.js template.
 */
export function wrapCoreRule(
  coreRuleName: string,
  options?: WrapRuleOptions
): PublicRuleModule {
  const coreRule = getCoreRule(coreRuleName)
  if (!coreRule) {
    return {
      meta: {
        type: 'problem',
        docs: {
          url: `https://eslint.vuejs.org/rules/${coreRuleName}.html`
        }
      },
      create(context: any) {
        return defineTemplateBodyVisitor(context, {
          "VElement[name='template'][parent.type='VDocumentFragment']"(
            node: any
          ) {
            context.report({
              node,
              message: `Failed to extend ESLint core rule "${coreRuleName}". You may be able to use this rule by upgrading the version of ESLint. If you cannot upgrade it, turn off this rule.`
            })
          }
        })
      }
    } satisfies RuleDefinition as RuleDefinition as PublicRuleModule
  }
  const rule = wrapRuleModule(coreRule, coreRuleName, options)
  const meta = {
    ...rule.meta,
    docs: {
      ...rule.meta.docs,
      extensionSource: {
        url: coreRule.meta.docs.url,
        name: 'ESLint core'
      }
    }
  }
  return {
    ...rule,
    meta
  } satisfies RuleDefinition as RuleDefinition as PublicRuleModule
}

export type RuleNames = { core: string; stylistic: string; vue: string }
/**
 * Wrap a core rule or ESLint Stylistic rule to apply it to Vue.js template.
 */
export function wrapStylisticOrCoreRule(
  ruleNames: RuleNames | string,
  options?: WrapRuleOptions
): PublicRuleModule {
  const stylisticRuleName =
    typeof ruleNames === 'string' ? ruleNames : ruleNames.stylistic
  const coreRuleName =
    typeof ruleNames === 'string' ? ruleNames : ruleNames.core
  const vueRuleName = typeof ruleNames === 'string' ? ruleNames : ruleNames.vue
  const stylisticRule = getStylisticRule(stylisticRuleName)
  const baseRule = stylisticRule || getCoreRule(coreRuleName)
  if (!baseRule) {
    return {
      meta: {
        type: 'problem',
        docs: {
          url: `https://eslint.vuejs.org/rules/${vueRuleName}.html`
        }
      },
      create(context: any) {
        return defineTemplateBodyVisitor(context, {
          "VElement[name='template'][parent.type='VDocumentFragment']"(
            node: any
          ) {
            context.report({
              node,
              message: `Failed to extend ESLint Stylistic rule "${stylisticRule}". You may be able to use this rule by installing ESLint Stylistic plugin (https://eslint.style/). If you cannot install it, turn off this rule.`
            })
          }
        })
      }
    } satisfies RuleDefinition as RuleDefinition as PublicRuleModule
  }
  const rule = wrapRuleModule(baseRule, vueRuleName, options)
  const description = stylisticRule
    ? `${stylisticRule.meta.docs.description} in \`<template>\``
    : rule.meta.docs.description
  const meta = {
    ...rule.meta,
    docs: {
      ...rule.meta.docs,
      description,
      extensionSource: {
        url: baseRule.meta.docs.url,
        name: stylisticRule ? 'ESLint Stylistic' : 'ESLint core'
      }
    },
    deprecated: undefined,
    replacedBy: undefined
  }
  return {
    ...rule,
    meta
  } satisfies RuleDefinition as RuleDefinition as PublicRuleModule
}
/**
 * Wrap a given rule to apply it to Vue.js template.
 */
function wrapRuleModule(
  baseRule: RuleModule,
  ruleName: string,
  options?: WrapRuleOptions
): RuleModule {
  let description = baseRule.meta.docs.description
  if (description) {
    description += ' in `<template>`'
  }

  const {
    categories,
    skipDynamicArguments,
    skipDynamicArgumentsReport,
    skipBaseHandlers,
    applyDocument,
    preprocess,
    create
  } = options || {}
  return {
    create(context: any) {
      const sourceCode = context.sourceCode
      const tokenStore =
        sourceCode.parserServices.getTemplateBodyTokenStore &&
        sourceCode.parserServices.getTemplateBodyTokenStore()

      // The `context.sourceCode` cannot access the tokens of templates.
      // So override the methods which access to tokens by the `tokenStore`.
      if (tokenStore) {
        context = wrapContextToOverrideTokenMethods(context, tokenStore, {
          applyDocument
        })
      }

      if (skipDynamicArgumentsReport) {
        context =
          wrapContextToOverrideReportMethodToSkipDynamicArgument(context)
      }

      const handlers: Record<string, any> = {}

      if (preprocess) {
        preprocess(context, {
          wrapContextToOverrideProperties(override: any) {
            context = newProxy(context, override)
            return context
          },
          defineVisitor(visitor: any) {
            compositingVisitors(handlers, visitor)
          }
        })
      }

      const baseHandlers = baseRule.create(context)
      if (!skipBaseHandlers) {
        compositingVisitors(handlers, baseHandlers)
      }

      // Move `Program` handlers to `VElement[parent.type!='VElement']`
      if (handlers.Program) {
        handlers[
          applyDocument
            ? 'VDocumentFragment'
            : "VElement[parent.type!='VElement']"
        ] = handlers.Program
        delete handlers.Program
      }
      if (handlers['Program:exit']) {
        handlers[
          applyDocument
            ? 'VDocumentFragment:exit'
            : "VElement[parent.type!='VElement']:exit"
        ] = handlers['Program:exit']
        delete handlers['Program:exit']
      }

      if (skipDynamicArguments) {
        let isWithinDynamicArguments = false
        for (const name of Object.keys(handlers)) {
          const original = handlers[name]

          handlers[name] = (...args: any[]) => {
            if (isWithinDynamicArguments) return
            original(...args)
          }
        }
        handlers['VDirectiveKey > VExpressionContainer'] = () => {
          isWithinDynamicArguments = true
        }
        handlers['VDirectiveKey > VExpressionContainer:exit'] = () => {
          isWithinDynamicArguments = false
        }
      }

      if (create) {
        compositingVisitors(handlers, create(context, { baseHandlers }))
      }

      return applyDocument
        ? defineDocumentVisitor(context, handlers)
        : defineTemplateBodyVisitor(context, handlers)
    },

    meta: Object.assign({}, baseRule.meta, {
      docs: Object.assign({}, baseRule.meta.docs, {
        description,
        category: null,
        categories,
        url: `https://eslint.vuejs.org/rules/${ruleName}.html`
      })
    })
  }
}

// ------------------------------------------------------------------------------
// Exports
// ------------------------------------------------------------------------------

/**
 * Get the previous sibling element of the given element.
 */
export function prevSibling(node: VElement) {
  let prevElement = null

  const siblings = (node.parent && node.parent.children) || []
  for (const siblingNode of siblings) {
    if (siblingNode === node) {
      return prevElement
    }
    if (siblingNode.type === 'VElement') {
      prevElement = siblingNode
    }
  }

  return null
}

/**
 * Check whether the given directive attribute has their empty value (`=""`).
 */
export function isEmptyValueDirective(node: VDirective, context: RuleContext) {
  if (node.value == null || node.value.expression != null) {
    return false
  }

  let valueText = context.sourceCode.getText(node.value)
  if (
    (valueText[0] === '"' || valueText[0] === "'") &&
    valueText[0] === valueText.at(-1)
  ) {
    // quoted
    valueText = valueText.slice(1, -1)
  }
  // empty
  return !valueText
}

/**
 * Check whether the given directive attribute has their empty expression value (e.g. `=" "`, `="/* &ast;/"`).
 */
export function isEmptyExpressionValueDirective(
  node: VDirective,
  context: RuleContext
) {
  if (node.value == null || node.value.expression != null) {
    return false
  }
  const sourceCode = context.sourceCode
  const valueNode = node.value
  const tokenStore = sourceCode.parserServices.getTemplateBodyTokenStore()
  let quote1 = null
  let quote2 = null
  // `node.value` may be only comments, so cannot get the correct tokens with `tokenStore.getTokens(node.value)`.
  for (const token of tokenStore.getTokens(node)) {
    if (token.range[1] <= valueNode.range[0]) {
      continue
    }
    if (valueNode.range[1] <= token.range[0]) {
      // empty
      return true
    }
    if (
      !quote1 &&
      token.type === 'Punctuator' &&
      (token.value === '"' || token.value === "'")
    ) {
      quote1 = token
      continue
    }
    if (
      !quote2 &&
      quote1 &&
      token.type === 'Punctuator' &&
      token.value === quote1.value
    ) {
      quote2 = token
      continue
    }
    // not empty
    return false
  }
  // empty
  return true
}

/**
 * Returns the list of all registered components
 */
export function getRegisteredComponents(componentObject: ObjectExpression) {
  const componentsNode = componentObject.properties.find(
    (p): p is Property & { value: ObjectExpression } =>
      p.type === 'Property' &&
      getStaticPropertyName(p) === 'components' &&
      p.value.type === 'ObjectExpression'
  )

  if (!componentsNode) {
    return []
  }

  return componentsNode.value.properties
    .filter(isProperty)
    .map((node: any) => {
      const name = getStaticPropertyName(node)
      return name ? { node, name } : null
    })
    .filter(isDef)
}

/**
 * Check whether the previous sibling element has `if` or `else-if` directive.
 */
export function prevElementHasIf(node: VElement) {
  const prev = prevSibling(node)
  return (
    prev != null &&
    prev.startTag.attributes.some(
      (a: any) =>
        a.directive &&
        (a.key.name.name === 'if' || a.key.name.name === 'else-if')
    )
  )
}

/**
 * Returns a generator with all child element v-if chains of the given element.
 */
export function* iterateChildElementsChains(node: VElement) {
  let isVIf = false

  let elementChain: VElement[] = []
  for (const childNode of node.children) {
    if (childNode.type === 'VElement') {
      let connected
      if (hasDirective(childNode, 'if')) {
        connected = false
        isVIf = true
      } else if (hasDirective(childNode, 'else-if')) {
        connected = isVIf
        isVIf = true
      } else if (hasDirective(childNode, 'else')) {
        connected = isVIf
        isVIf = false
      } else {
        connected = false
        isVIf = false
      }

      if (connected) {
        elementChain.push(childNode)
      } else {
        if (elementChain.length > 0) {
          yield elementChain
        }
        elementChain = [childNode]
      }
    } else if (childNode.type !== 'VText' || childNode.value.trim() !== '') {
      isVIf = false
    }
  }
  if (elementChain.length > 0) {
    yield elementChain
  }
}

/**
 * Check whether the given node is a custom component or not.
 */
export function isCustomComponent(
  node: VElement,
  shouldIgnoreElementNamespaces = false
) {
  if (
    hasAttribute(node, 'is') ||
    hasDirective(node, 'bind', 'is') ||
    hasDirective(node, 'is')
  ) {
    return true
  }

  const isHtmlName = isHtmlWellKnownElementName(node.rawName)
  const isSvgName = isSvgWellKnownElementName(node.rawName)
  const isMathName = isMathWellKnownElementName(node.rawName)

  return shouldIgnoreElementNamespaces
    ? !isHtmlName && !isSvgName && !isMathName
    : (isHtmlElementNode(node) && !isHtmlName) ||
        (isSvgElementNode(node) && !isSvgName) ||
        (isMathElementNode(node) && !isMathName)
}

/**
 * Check whether the given node is a HTML element or not.
 */
export function isHtmlElementNode(node: VElement) {
  return node.namespace === NS.HTML
}

/**
 * Check whether the given node is a SVG element or not.
 */
export function isSvgElementNode(node: VElement) {
  return node.namespace === NS.SVG
}

/**
 * Check whether the given name is a MathML element or not.
 */
export function isMathElementNode(node: VElement) {
  return node.namespace === NS.MathML
}

/**
 * Check whether the given name is an well-known element or not.
 */
export function isHtmlWellKnownElementName(name: string) {
  return HTML_ELEMENT_NAMES.has(name)
}

/**
 * Check whether the given name is an well-known SVG element or not.
 */
export function isSvgWellKnownElementName(name: string) {
  return SVG_ELEMENT_NAMES.has(name)
}

/**
 * Check whether the given name is a well-known MathML element or not.
 */
export function isMathWellKnownElementName(name: string) {
  return MATH_ELEMENT_NAMES.has(name)
}

/**
 * Check whether the given name is a void element name or not.
 */
export function isHtmlVoidElementName(name: string) {
  return VOID_ELEMENT_NAMES.has(name)
}

/**
 * Check whether the given name is Vue builtin component name or not.
 */
export function isBuiltInComponentName(name: string) {
  return VUE3_BUILTIN_COMPONENT_NAMES.has(name)
}

/**
 * Check whether the given name is Vue builtin element name or not.
 */
export function isVueBuiltInElementName(name: string) {
  return VUE_BUILTIN_ELEMENT_NAMES.has(name.toLowerCase())
}

/**
 * Check whether the given name is Vue builtin directive name or not.
 */
export function isBuiltInDirectiveName(name: string) {
  return BUILTIN_DIRECTIVE_NAMES.has(name)
}

/**
 * Get all computed properties by looking at all component's properties
 */
export function getComputedProperties(componentObject: ObjectExpression) {
  const computedPropertiesNode = componentObject.properties.find(
    (p): p is Property & { value: ObjectExpression } =>
      p.type === 'Property' &&
      getStaticPropertyName(p) === 'computed' &&
      p.value.type === 'ObjectExpression'
  )

  if (!computedPropertiesNode) {
    return []
  }

  return computedPropertiesNode.value.properties
    .filter(isProperty)
    .map((cp: any) => {
      const key = getStaticPropertyName(cp)

      const propValue = skipTSAsExpression(cp.value)

      let value = null

      if (propValue.type === 'FunctionExpression') {
        value = propValue.body
      } else if (propValue.type === 'ObjectExpression') {
        const get = findProperty(
          propValue,
          'get',
          (p: any) => p.value.type === 'FunctionExpression'
        )
        value = get?.value.type === 'FunctionExpression' ? get.value.body : null
      }

      return { key, value }
    })
}

/**
 * Get getter body from computed function
 */
export function getGetterBodyFromComputedFunction(
  callExpression: CallExpression
): FunctionExpression | ArrowFunctionExpression | null {
  if (callExpression.arguments.length === 0) {
    return null
  }

  const arg = callExpression.arguments[0]

  if (
    arg.type === 'FunctionExpression' ||
    arg.type === 'ArrowFunctionExpression'
  ) {
    return arg
  }

  if (arg.type === 'ObjectExpression') {
    const getProperty = findProperty(
      arg,
      'get',
      (p: any) =>
        p.value.type === 'FunctionExpression' ||
        p.value.type === 'ArrowFunctionExpression'
    )
    return getProperty?.value.type === 'FunctionExpression' ||
      getProperty?.value.type === 'ArrowFunctionExpression'
      ? getProperty.value
      : null
  }

  return null
}

/**
 * Check if current file is a Vue instance or component and call callback
 */
export function executeOnVue(
  context: RuleContext,
  cb: (node: ObjectExpression, type: VueObjectType) => void
) {
  return compositingVisitors(
    executeOnVueComponent(context, cb),
    executeOnVueInstance(context, cb)
  )
}

/**
 * Define handlers to traverse the Vue Objects.
 * Some special events are available to visitor.
 *
 * - `onVueObjectEnter` ... Event when Vue Object is found.
 * - `onVueObjectExit` ... Event when Vue Object visit ends.
 * - `onSetupFunctionEnter` ... Event when setup function found.
 * - `onRenderFunctionEnter` ... Event when render function found.
 */
export function defineVueVisitor(context: RuleContext, visitor: VueVisitor) {
  let vueStack: VueObjectData | null = null

  function callVisitor(key: string, node: ESNode) {
    if (vueStack && visitor[key]) {
      // @ts-expect-error -- dynamic AST shape or visitor key
      visitor[key](node, vueStack)
    }
  }

  const vueVisitor: Record<string, any> = {}
  for (const key in visitor) {
    vueVisitor[key] = (node: any) => callVisitor(key, node)
  }

  vueVisitor.ObjectExpression = (node: ObjectExpression) => {
    const type = getVueObjectType(context, node)
    if (type) {
      vueStack = {
        node,
        type,
        parent: vueStack,
        get functional() {
          const functional = node.properties.find(
            (p): p is Property =>
              p.type === 'Property' && getStaticPropertyName(p) === 'functional'
          )
          return (
            functional !== undefined &&
            (functional.value.type !== 'Literal' ||
              functional.value.value !== false)
          )
        }
      }
      callVisitor('onVueObjectEnter', node)
    }
    callVisitor('ObjectExpression', node)
  }
  vueVisitor['ObjectExpression:exit'] = (node: any) => {
    callVisitor('ObjectExpression:exit', node)
    if (!(vueStack && vueStack.node === node)) {
      return
    }

    callVisitor('onVueObjectExit', node)
    vueStack = vueStack.parent
  }
  if (
    visitor.onSetupFunctionEnter ||
    visitor.onSetupFunctionExit ||
    visitor.onRenderFunctionEnter
  ) {
    const setups = new Set()

    vueVisitor[
      'Property[value.type=/^(Arrow)?FunctionExpression$/] > :function'
    ] = (
      node: (FunctionExpression | ArrowFunctionExpression) & {
        parent: Property
      }
    ) => {
      const prop = node.parent
      if (vueStack && prop.parent === vueStack.node && prop.value === node) {
        const name = getStaticPropertyName(prop)
        if (name === 'setup') {
          callVisitor('onSetupFunctionEnter', node)
          setups.add(node)
        } else if (name === 'render') {
          callVisitor('onRenderFunctionEnter', node)
        }
      }
      callVisitor(
        'Property[value.type=/^(Arrow)?FunctionExpression$/] > :function',
        node
      )
    }
    if (visitor.onSetupFunctionExit) {
      vueVisitor[
        'Property[value.type=/^(Arrow)?FunctionExpression$/] > :function:exit'
      ] = (
        node: (FunctionExpression | ArrowFunctionExpression) & {
          parent: Property
        }
      ) => {
        if (!setups.has(node)) {
          return
        }

        callVisitor('onSetupFunctionExit', node)
        setups.delete(node)
      }
    }
  }

  return vueVisitor
}

/**
 * Define handlers to traverse the AST nodes in `<script setup>`.
 * Some special events are available to visitor.
 *
 * - `onDefinePropsEnter` ... Event when defineProps is found.
 * - `onDefinePropsExit` ... Event when defineProps visit ends.
 * - `onDefineEmitsEnter` ... Event when defineEmits is found.
 * - `onDefineEmitsExit` ... Event when defineEmits visit ends.
 * - `onDefineOptionsEnter` ... Event when defineOptions is found.
 * - `onDefineOptionsExit` ... Event when defineOptions visit ends.
 * - `onDefineSlotsEnter` ... Event when defineSlots is found.
 * - `onDefineSlotsExit` ... Event when defineSlots visit ends.
 * - `onDefineExposeEnter` ... Event when defineExpose is found.
 * - `onDefineExposeExit` ... Event when defineExpose visit ends.
 * - `onDefineModelEnter` ... Event when defineModel is found.
 * - `onDefineModelExit` ... Event when defineModel visit ends.
 */
export function defineScriptSetupVisitor(
  context: RuleContext,
  visitor: ScriptSetupVisitor
) {
  const scriptSetup = getScriptSetupElement(context)
  if (scriptSetup == null) {
    return {}
  }
  const scriptSetupRange = scriptSetup.range

  function isInScriptSetup(node: ESNode) {
    return (
      scriptSetupRange[0] <= node.range[0] &&
      node.range[1] <= scriptSetupRange[1]
    )
  }

  function callVisitor(key: string, node: ESNode, ...args: any[]) {
    if (visitor[key] && (node.type === 'Program' || isInScriptSetup(node))) {
      // @ts-expect-error -- dynamic AST shape or visitor key
      visitor[key](node, ...args)
    }
  }

  const scriptSetupVisitor: Record<string, any> = {}
  for (const key in visitor) {
    scriptSetupVisitor[key] = (node: any) => callVisitor(key, node)
  }

  class MacroListener {
    declare name: string
    declare enterName: string
    declare exitName: string
    declare isMacroNode: (
      candidateMacro: Expression | null,
      node: CallExpression
    ) => boolean
    declare buildParam: (context: RuleContext, node: CallExpression) => unknown
    declare hasListener: boolean
    declare paramsMap: Map<CallExpression, unknown>

    constructor(
      name: string,
      enterName: string,
      exitName: string,
      isMacroNode: (
        candidateMacro: Expression | null,
        node: CallExpression
      ) => boolean,
      buildParam: (context: RuleContext, node: CallExpression) => unknown
    ) {
      this.name = name
      this.enterName = enterName
      this.exitName = exitName
      this.isMacroNode = isMacroNode
      this.buildParam = buildParam
      this.hasListener = Boolean(
        visitor[this.enterName] || visitor[this.exitName]
      )
      this.paramsMap = new Map()
    }
  }
  const macroListenerList = [
    new MacroListener(
      'defineProps',
      'onDefinePropsEnter',
      'onDefinePropsExit',
      (candidateMacro: any, node: any) =>
        candidateMacro === node || candidateMacro === getWithDefaults(node),
      getComponentPropsFromDefineProps
    ),
    new MacroListener(
      'defineEmits',
      'onDefineEmitsEnter',
      'onDefineEmitsExit',
      (candidateMacro: any, node: any) => candidateMacro === node,
      getComponentEmitsFromDefineEmits
    ),
    new MacroListener(
      'defineOptions',
      'onDefineOptionsEnter',
      'onDefineOptionsExit',
      (candidateMacro: any, node: any) => candidateMacro === node,
      () => undefined
    ),
    new MacroListener(
      'defineSlots',
      'onDefineSlotsEnter',
      'onDefineSlotsExit',
      (candidateMacro: any, node: any) => candidateMacro === node,
      getComponentSlotsFromDefineSlots
    ),
    new MacroListener(
      'defineExpose',
      'onDefineExposeEnter',
      'onDefineExposeExit',
      (candidateMacro: any, node: any) => candidateMacro === node,
      () => undefined
    ),
    new MacroListener(
      'defineModel',
      'onDefineModelEnter',
      'onDefineModelExit',
      (candidateMacro: any, node: any) => candidateMacro === node,
      getComponentModelFromDefineModel
    )
  ].filter((m) => m.hasListener)
  if (macroListenerList.length > 0) {
    let candidateMacro: Expression | null = null

    scriptSetupVisitor[
      'Program > VariableDeclaration > VariableDeclarator, Program > ExpressionStatement'
    ] = (node: VariableDeclarator | ExpressionStatement) => {
      if (!candidateMacro) {
        candidateMacro =
          node.type === 'VariableDeclarator' ? node.init : node.expression
      }
    }

    scriptSetupVisitor[
      'Program > VariableDeclaration > VariableDeclarator, Program > ExpressionStatement:exit'
    ] = (node: VariableDeclarator | ExpressionStatement) => {
      if (
        candidateMacro ===
        (node.type === 'VariableDeclarator' ? node.init : node.expression)
      ) {
        candidateMacro = null
      }
    }

    scriptSetupVisitor.CallExpression = (node: CallExpression) => {
      if (
        candidateMacro &&
        isInScriptSetup(node) &&
        node.callee.type === 'Identifier'
      ) {
        for (const macroListener of macroListenerList) {
          if (
            node.callee.name !== macroListener.name ||
            !macroListener.isMacroNode(candidateMacro, node)
          ) {
            continue
          }
          const param = macroListener.buildParam(context, node)
          callVisitor(macroListener.enterName, node, param)
          macroListener.paramsMap.set(node, param)
          break
        }
      }
      callVisitor('CallExpression', node)
    }
    scriptSetupVisitor['CallExpression:exit'] = (node: any) => {
      callVisitor('CallExpression:exit', node)
      for (const macroListener of macroListenerList) {
        if (!macroListener.paramsMap.has(node)) {
          continue
        }

        callVisitor(
          macroListener.exitName,
          node,
          macroListener.paramsMap.get(node)
        )
        macroListener.paramsMap.delete(node)
      }
    }
  }

  return scriptSetupVisitor
}

/**
 * Collects the property expressions of the object that the given node refers
 * to, following `const` references and spread elements. Properties are
 * collected in source order, so a later definition overrides an earlier one.
 */
function collectPropExpressions(
  context: RuleContext,
  node: ESNode,
  result: Record<string, Expression | undefined>,
  visited: Set<ObjectExpression>
) {
  const object = getObjectOrArray(context, node)
  if (object?.type !== 'ObjectExpression') {
    return false
  }
  if (visited.has(object)) {
    return true
  }
  visited.add(object)

  let isResolved = true
  for (const property of object.properties) {
    if (property.type === 'SpreadElement') {
      if (
        !collectPropExpressions(context, property.argument, result, visited)
      ) {
        isResolved = false
      }
      continue
    }
    const name = getStaticPropertyName(property)
    if (name == null) {
      isResolved = false
      continue
    }
    result[name] = property.value
  }
  return isResolved
}

/**
 * Gets a map of the expressions defined in withDefaults.
 */
export function getWithDefaultsPropExpressions(
  context: RuleContext,
  node: CallExpression
) {
  const props: Record<string, Expression | undefined> = {}
  if (!hasWithDefaults(node)) {
    return { props, hasUnknown: false }
  }
  const defaults = node.parent.arguments[1]
  if (!defaults) {
    return { props, hasUnknown: false }
  }
  return {
    props,
    hasUnknown: !collectPropExpressions(context, defaults, props, new Set())
  }
}

/**
 * Checks whether the given defineProps node is using Props Destructure.
 */
export function isUsingPropsDestructure(node: CallExpression) {
  const left = getLeftOfDefineProps(node)
  return left?.type === 'ObjectPattern'
}

/**
 * Check if current file is a Vue instance (new Vue) and call callback
 */
export function executeOnVueInstance(
  context: RuleContext,
  cb: (node: ObjectExpression, type: VueObjectType) => void
) {
  return {
    'ObjectExpression:exit'(node: ObjectExpression) {
      const type = getVueObjectType(context, node)
      if (!type || type !== 'instance') return
      cb(node, type)
    }
  }
}

/**
 * Check if current file is a Vue component and call callback
 */
export function executeOnVueComponent(
  context: RuleContext,
  cb: (node: ObjectExpression, type: VueObjectType) => void
) {
  const types = new Set(['mark', 'export', 'definition'])
  return {
    'ObjectExpression:exit'(node: ObjectExpression) {
      const type = getVueObjectType(context, node)
      if (type && types.has(type)) {
        cb(node, type)
      }
    }
  }
}

/**
 * Check call `Vue.component` and call callback.
 */
export function executeOnCallVueComponent(
  _context: RuleContext,
  cb: (node: CallExpression) => void
) {
  return {
    "CallExpression > MemberExpression > Identifier[name='component']": (
      node: Identifier & {
        parent: MemberExpression & { parent: CallExpression }
      }
    ) => {
      const callExpr = node.parent.parent
      const callee = callExpr.callee

      if (callee.type !== 'MemberExpression') {
        return
      }

      const calleeObject = skipTSAsExpression(callee.object)

      if (
        calleeObject.type === 'Identifier' &&
        // calleeObject.name === 'Vue' && // Any names can be used in Vue.js 3.x. e.g. app.component()
        callee.property === node &&
        callExpr.arguments.length > 0
      ) {
        cb(callExpr)
      }
    }
  }
}

/**
 * Return generator with all properties
 */
export function* iterateProperties(
  node: ObjectExpression,
  groups: Set<GroupName>
): Generator<ComponentPropertyData> {
  for (const item of node.properties) {
    if (item.type !== 'Property') {
      continue
    }

    const name = getStaticPropertyName(item)
    if (!name || !groups.has(name as GroupName)) continue

    yield* iteratePropertyValue(item.value, name as GroupName)
  }
}

/**
 * Return generator with all properties defined by the given property value.
 */
export function* iteratePropertyValue(
  value: Expression,
  groupName: GroupName
): Generator<ComponentPropertyData> {
  switch (value.type) {
    case 'ArrayExpression': {
      yield* iterateArrayExpression(value, groupName)
      break
    }
    case 'ObjectExpression': {
      yield* iterateObjectExpression(value, groupName)
      break
    }
    case 'FunctionExpression': {
      yield* iterateFunctionExpression(value, groupName)
      break
    }
    case 'ArrowFunctionExpression': {
      yield* iterateArrowFunctionExpression(value, groupName)
      break
    }
  }
}

/**
 * Return generator with all elements inside ArrayExpression
 */
export function* iterateArrayExpression(
  node: ArrayExpression,
  groupName: GroupName
): Generator<ComponentArrayPropertyData> {
  for (const item of node.elements) {
    if (!item || (item.type !== 'Literal' && item.type !== 'TemplateLiteral')) {
      continue
    }

    const name = getStringLiteralValue(item)
    if (name) {
      yield { type: 'array', name, groupName, node: item }
    }
  }
}

/**
 * Return generator with all elements inside ObjectExpression
 */
export function* iterateObjectExpression(
  node: ObjectExpression,
  groupName: GroupName
): Generator<ComponentObjectPropertyData> {
  let usedGetter: Set<Property> | undefined
  for (const item of node.properties) {
    if (item.type !== 'Property') {
      continue
    }

    const key = item.key
    if (
      // eslint-disable-next-line unicorn/prefer-includes-over-repeated-comparisons -- needed for type narrowing
      key.type !== 'Identifier' &&
      key.type !== 'Literal' &&
      key.type !== 'TemplateLiteral'
    ) {
      continue
    }
    const name = getStaticPropertyName(item)
    if (!name) {
      continue
    }

    // find getter pair
    const hasGetterPair =
      item.kind === 'set' &&
      node.properties.some((item2: any) => {
        if (item2.type === 'Property' && item2.kind === 'get') {
          if (!usedGetter) {
            usedGetter = new Set()
          }
          if (usedGetter.has(item2)) {
            return false
          }
          const getterName = getStaticPropertyName(item2)
          if (getterName === name) {
            usedGetter.add(item2)
            return true
          }
        }
        return false
      })
    if (hasGetterPair) {
      continue
    }
    yield {
      type: 'object',
      name,
      groupName,
      node: key,
      property: item
    }
  }
}

/**
 * Return generator with all elements inside FunctionExpression
 */
export function* iterateFunctionExpression(
  node: FunctionExpression,
  groupName: GroupName
): Generator<ComponentObjectPropertyData> {
  if (node.body.type === 'BlockStatement') {
    for (const item of node.body.body) {
      if (
        item.type === 'ReturnStatement' &&
        item.argument &&
        item.argument.type === 'ObjectExpression'
      ) {
        yield* iterateObjectExpression(item.argument, groupName)
      }
    }
  }
}

/**
 * Return generator with all elements inside ArrowFunctionExpression
 */
export function* iterateArrowFunctionExpression(
  node: ArrowFunctionExpression,
  groupName: GroupName
): Generator<ComponentObjectPropertyData> {
  const body = node.body
  if (body.type === 'BlockStatement') {
    for (const item of body.body) {
      if (
        item.type === 'ReturnStatement' &&
        item.argument &&
        item.argument.type === 'ObjectExpression'
      ) {
        yield* iterateObjectExpression(item.argument, groupName)
      }
    }
  } else if (body.type === 'ObjectExpression') {
    yield* iterateObjectExpression(body, groupName)
  }
}

/**
 * Find all functions which do not always return values
 */
export function executeOnFunctionsWithoutReturn(
  context: RuleContext,
  shouldTreatUndefinedAsUnspecified: boolean,
  cb: (
    node: ArrowFunctionExpression | FunctionExpression | FunctionDeclaration
  ) => void
) {
  type FuncInfo = {
    funcInfo: FuncInfo | null
    codePath: CodePath
    hasReturn: boolean
    hasReturnValue: boolean
    node: ArrowFunctionExpression | FunctionExpression | FunctionDeclaration
    currentSegments: CodePathSegment[]
  }

  let funcInfo: FuncInfo | null = null

  // "Spurious" = ESLint sees the segment as reachable, but TypeScript proves
  // it can't actually execute (the phantom no-match edge of a type-exhaustive
  // switch with no default).

  const spuriousSegments = new WeakSet()

  // Segments started inside a switch case body. Lets us distinguish post-switch
  // reachability via a real path (break, fall-through) from the phantom no-match
  // path. Depth is a counter to support nested switches.

  const caseBodySegments = new WeakSet()
  let caseBodyDepth = 0

  /**
   * Treat spurious segments the same as unreachable.
   */
  function isEffectivelyUnreachable(segment: CodePathSegment) {
    return !segment.reachable || spuriousSegments.has(segment)
  }

  function isValidReturn() {
    if (!funcInfo) {
      return true
    }
    return funcInfo.currentSegments.some(
      (segment: any) => !isEffectivelyUnreachable(segment)
    )
      ? false
      : !shouldTreatUndefinedAsUnspecified || funcInfo.hasReturnValue
  }

  return {
    onCodePathStart(codePath: CodePath, node: ESNode) {
      if (
        // eslint-disable-next-line unicorn/prefer-includes-over-repeated-comparisons -- narrows `node`'s type for `funcInfo` below
        node.type === 'ArrowFunctionExpression' ||
        node.type === 'FunctionExpression' ||
        node.type === 'FunctionDeclaration'
      ) {
        funcInfo = {
          codePath,
          currentSegments: [],
          funcInfo,
          hasReturn: false,
          hasReturnValue: false,
          node
        }
      }
    },

    onCodePathSegmentStart(segment: CodePathSegment) {
      funcInfo?.currentSegments.push(segment)
      // Spurious propagates: if every reachable predecessor is spurious, so is this segment.
      if (
        segment.prevSegments.length > 0 &&
        segment.prevSegments.every(isEffectivelyUnreachable)
      ) {
        spuriousSegments.add(segment)
      }
      if (caseBodyDepth > 0) {
        caseBodySegments.add(segment)
      }
    },
    onCodePathSegmentEnd() {
      funcInfo?.currentSegments.pop()
    },
    onCodePathEnd() {
      funcInfo &&= funcInfo.funcInfo
    },

    ReturnStatement(node: ReturnStatement) {
      if (!funcInfo) {
        return
      }

      funcInfo.hasReturn = true
      funcInfo.hasReturnValue = Boolean(node.argument)
    },
    SwitchCase() {
      caseBodyDepth++
    },
    'SwitchCase:exit'() {
      caseBodyDepth--
    },

    'SwitchStatement:exit'(node: SwitchStatement) {
      if (
        !funcInfo ||
        node.cases.some((switchCase: any) => switchCase.test === null) ||
        !isExhaustiveSwitch(context, node)
      ) {
        // Switches with `default` are handled correctly by ESLint already.
        return
      }

      // If any reachable predecessor came from inside a case body, the switch
      // genuinely falls through (break or fall-through). Otherwise the only
      // incoming edge is the phantom no-match path — safe to mark spurious.
      const fromCaseBody = funcInfo.currentSegments.some((post: any) =>
        post.prevSegments.some(
          (prev: any) =>
            !isEffectivelyUnreachable(prev) && caseBodySegments.has(prev)
        )
      )
      if (fromCaseBody) return

      for (const segment of funcInfo.currentSegments) {
        spuriousSegments.add(segment)
      }
    },

    'ArrowFunctionExpression:exit'(node: ArrowFunctionExpression) {
      if (funcInfo && !isValidReturn() && !node.expression) {
        cb(funcInfo.node)
      }
    },
    'FunctionExpression:exit'() {
      if (funcInfo && !isValidReturn()) {
        cb(funcInfo.node)
      }
    }
  }
}

/**
 * Check whether the component is declared in a single line or not.
 */
export function isSingleLine(node: ASTNode) {
  return node.loc.start.line === node.loc.end.line
}

/**
 * Check whether the templateBody of the program has invalid EOF or not.
 */
export function hasInvalidEOF(node: Program) {
  const body = node.templateBody
  return body == null || body.errors == null
    ? false
    : body.errors.some(
        (error: any) =>
          typeof error.code === 'string' && error.code.startsWith('eof-')
      )
}

/**
 * Get the chaining nodes of MemberExpression.
 */
export function getMemberChaining(
  node: ESNode
): [ESNode, ...MemberExpression[]] {
  const nodes: MemberExpression[] = []
  let n = skipChainExpression(node)

  while (n.type === 'MemberExpression') {
    nodes.push(n)
    n = skipChainExpression(n.object)
  }

  return [n, ...nodes.reverse()]
}

/**
 * return two string editdistance
 */
export function editDistance(a: string, b: string) {
  if (a === b) {
    return 0
  }
  const alen = a.length
  const blen = b.length
  const dp = Array.from({ length: alen + 1 }, () =>
    Array.from({ length: blen + 1 }, () => 0)
  )
  for (let i = 0; i <= alen; i++) {
    dp[i][0] = i
  }
  for (let j = 0; j <= blen; j++) {
    dp[0][j] = j
  }
  for (let i = 1; i <= alen; i++) {
    for (let j = 1; j <= blen; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
    }
  }
  return dp[alen][blen]
}

/**
 * Checks whether the target node is within the given range.
 */
export function isInRange(
  rangeOrNode: [number, number] | ASTNode | Token,
  target: ASTNode | Token
) {
  const range = Array.isArray(rangeOrNode) ? rangeOrNode : rangeOrNode.range
  return range[0] <= target.range[0] && target.range[1] <= range[1]
}

/**
 * Check whether the given node is `this` or variable that stores `this`.
 */
export function isThis(node: ESNode, context: RuleContext) {
  if (node.type === 'ThisExpression') {
    return true
  }
  if (node.type !== 'Identifier') {
    return false
  }
  const parent = node.parent
  if (
    (parent.type === 'MemberExpression' && parent.property === node) ||
    (parent.type === 'Property' && parent.key === node && !parent.computed)
  ) {
    return false
  }

  const variable = (findVariable as unknown as WithVue<typeof findVariable>)(
    getScope(context, node),
    node
  )

  if (variable != null && variable.defs.length === 1) {
    const def = variable.defs[0]
    if (
      def.type === 'Variable' &&
      def.parent.kind === 'const' &&
      def.node.id.type === 'Identifier'
    ) {
      return Boolean(
        def.node && def.node.init && def.node.init.type === 'ThisExpression'
      )
    }
  }
  return false
}

/**
 * Check if a call expression is Object.assign with the given node as first argument
 */
export function isObjectAssignCall(
  callExpr: CallExpression,
  targetNode: ASTNode
) {
  const { callee, arguments: args } = callExpr

  return (
    args.length > 0 &&
    args[0] === targetNode &&
    callee?.type === 'MemberExpression' &&
    callee.object?.type === 'Identifier' &&
    callee.object.name === 'Object' &&
    callee.property?.type === 'Identifier' &&
    callee.property.name === 'assign'
  )
}

export function findMutating(props: MemberExpression | Identifier) {
  const pathNodes: MemberExpression[] = []

  let node = props
  let target = node.parent
  while (true) {
    const step: any = findMutatingStep(node, target, pathNodes)
    if (step.done) {
      return step.result
    }
    node = step.node
    target = step.target
  }
}

/**
 * Resolve a single step of the parent chain walk in `findMutating`.
 */
export function findMutatingStep(
  node: MemberExpression | Identifier | ChainExpression,
  target: ASTNode,
  pathNodes: MemberExpression[]
) {
  switch (target.type) {
    case 'AssignmentExpression': {
      if (target.left === node) {
        // this.xxx <=|+=|-=>
        return {
          done: true,
          result: { kind: 'assignment', node: target, pathNodes }
        }
      }
      return { done: true, result: null }
    }
    case 'UpdateExpression': {
      // this.xxx <++|-->
      return {
        done: true,
        result: { kind: 'update', node: target, pathNodes }
      }
    }
    case 'UnaryExpression': {
      if (target.operator === 'delete') {
        return {
          done: true,
          result: { kind: 'update', node: target, pathNodes }
        }
      }
      return { done: true, result: null }
    }
    case 'CallExpression': {
      const mem = pathNodes.at(-1)
      if (mem && target.callee === node) {
        const callName = getStaticPropertyName(mem)
        if (
          callName &&
          /^(?:push|pop|shift|unshift|reverse|splice|sort|copyWithin|fill)$/u.test(
            callName
          )
        ) {
          // this.xxx.push()
          pathNodes.pop()
          return {
            done: true,
            result: { kind: 'call', node: target, pathNodes }
          }
        }
      }
      if (isObjectAssignCall(target, node)) {
        // Object.assign(xxx, {})
        return {
          done: true,
          result: { kind: 'call', node: target, pathNodes }
        }
      }
      return { done: true, result: null }
    }
    case 'MemberExpression': {
      if (target.object === node) {
        pathNodes.push(target)
        return { done: false, node: target, target: target.parent }
      }
      return { done: true, result: null }
    }
    case 'ChainExpression': {
      return { done: false, node: target, target: target.parent }
    }
    default: {
      return { done: true, result: null }
    }
  }
}

/**
 * Iterates all references in the given trace map.
 * Take the third argument option to detect auto-imported references.
 */
export function* iterateReferencesTraceMap(
  tracker: import('@eslint-community/eslint-utils').ReferenceTracker,
  map: import('@eslint-community/eslint-utils').TraceMap<unknown>
) {
  const esmTraceMap = createCompositionApiTraceMap({
    ...map,
    [ReferenceTracker.ESM]: true
  })

  for (const ref of tracker.iterateEsmReferences(
    esmTraceMap
  ) as unknown as WithVue<ReturnType<typeof tracker.iterateEsmReferences>>) {
    yield ref
  }

  for (const ref of tracker.iterateGlobalReferences(map) as unknown as WithVue<
    ReturnType<typeof tracker.iterateGlobalReferences>
  >) {
    yield ref
  }
}

/**
 * Checks whether or not the tokens of two given nodes are same.
 */
export function equalTokens(
  left: ASTNode,
  right: ASTNode,
  sourceCode: ParserServices.TokenStore | SourceCode
) {
  const tokensL = sourceCode.getTokens(left)
  const tokensR = sourceCode.getTokens(right)

  return tokensL.length === tokensR.length
    ? tokensL.every(
        (token: any, i: any) =>
          token.type === tokensR[i].type && token.value === tokensR[i].value
      )
    : false
}

// ------------------------------------------------------------------------------
// Standard Helpers
// ------------------------------------------------------------------------------

/**
 * Checks whether the given value is defined.
 */
export function isDef<T>(v: T | null | undefined): v is T {
  return v != null
}

/**
 * Flattens arrays, objects and iterable objects.
 */
export function flatten<T>(v: T | Iterable<T> | null | undefined): T[] {
  const result = []
  if (v) {
    if (isIterable(v)) {
      result.push(...v)
    } else {
      result.push(v)
    }
  }
  return result
}

function isIterable<T>(v: T | Iterable<T>): v is Iterable<T> {
  return typeof v === 'object' && v !== null && Symbol.iterator in v
}

// ------------------------------------------------------------------------------
// Rule Helpers
// ------------------------------------------------------------------------------

/**
 * Register the given visitor to parser services.
 * If the parser service of `vue-eslint-parser` was not found,
 * this generates a warning.
 */
export function defineTemplateBodyVisitor(
  context: RuleContext,
  templateBodyVisitor: TemplateListener,
  scriptVisitor?: RuleListener,
  options?: { templateBodyTriggerSelector: 'Program' | 'Program:exit' }
) {
  const sourceCode = context.sourceCode
  if (sourceCode.parserServices.defineTemplateBodyVisitor == null) {
    const filename = context.filename
    if (path.extname(filename) === '.vue') {
      context.report({
        loc: { line: 1, column: 0 },
        message:
          'Use the latest vue-eslint-parser. See also https://eslint.vuejs.org/user-guide/#what-is-the-use-the-latest-vue-eslint-parser-error.'
      })
    }
    return {}
  }
  return sourceCode.parserServices.defineTemplateBodyVisitor(
    templateBodyVisitor,
    scriptVisitor,
    options
  )
}
/**
 * Register the given visitor to parser services.
 * If the parser service of `vue-eslint-parser` was not found,
 * this generates a warning.
 */
export function defineDocumentVisitor(
  context: RuleContext,
  documentVisitor: TemplateListener,
  options?: { triggerSelector: 'Program' | 'Program:exit' }
) {
  const sourceCode = context.sourceCode
  if (sourceCode.parserServices.defineDocumentVisitor == null) {
    const filename = context.filename
    if (path.extname(filename) === '.vue') {
      context.report({
        loc: { line: 1, column: 0 },
        message:
          'Use the latest vue-eslint-parser. See also https://eslint.vuejs.org/user-guide/#what-is-the-use-the-latest-vue-eslint-parser-error.'
      })
    }
    return {}
  }
  return sourceCode.parserServices.defineDocumentVisitor(
    documentVisitor,
    options
  )
}

export function compositingVisitors<T>(visitor: T, ...visitors: any[]) {
  for (const v of visitors) {
    for (const key in v) {
      // @ts-expect-error -- dynamic AST shape or visitor key
      if (visitor[key]) {
        // @ts-expect-error -- dynamic AST shape or visitor key
        const o = visitor[key]
        // @ts-expect-error -- dynamic AST shape or visitor key
        visitor[key] = (...args) => {
          o(...args)
          v[key](...args)
        }
      } else {
        // @ts-expect-error -- dynamic AST shape or visitor key
        visitor[key] = v[key]
      }
    }
  }
  return visitor
}

// ------------------------------------------------------------------------------
// AST Helpers
// ------------------------------------------------------------------------------

/**
 * Find the variable of a given identifier.
 */
export function findVariableByIdentifier(
  context: RuleContext,
  node: Identifier
) {
  return (findVariable as unknown as WithVue<typeof findVariable>)(
    getScope(context, node),
    node
  )
}

/**
 * Finds the property with the given name from the given ObjectExpression node.
 */
export function findProperty(
  node: ObjectExpression,
  name: string,
  isIncluded?: (p: Property) => boolean
): Property | null {
  const predicate = isIncluded
    ? (prop: Property | SpreadElement): prop is Property =>
        isProperty(prop) &&
        getStaticPropertyName(prop) === name &&
        isIncluded(prop)
    : (prop: Property | SpreadElement): prop is Property =>
        isProperty(prop) && getStaticPropertyName(prop) === name
  return node.properties.find(predicate) || null
}

/**
 * Finds the assignment property with the given name from the given ObjectPattern node.
 */
export function findAssignmentProperty(
  node: ObjectPattern,
  name: string,
  isIncluded?: (p: AssignmentProperty) => boolean
): AssignmentProperty | null {
  const predicate = isIncluded
    ? (prop: AssignmentProperty | RestElement): prop is AssignmentProperty =>
        isAssignmentProperty(prop) &&
        getStaticPropertyName(prop) === name &&
        isIncluded(prop)
    : (prop: AssignmentProperty | RestElement): prop is AssignmentProperty =>
        isAssignmentProperty(prop) && getStaticPropertyName(prop) === name
  return node.properties.find(predicate) || null
}

/**
 * Checks whether the given node is Property.
 */
export function isProperty(
  node: Property | SpreadElement | AssignmentProperty
): node is Property {
  return (
    node.type === 'Property' &&
    (!node.parent || node.parent.type === 'ObjectExpression')
  )
}
/**
 * Checks whether the given node is AssignmentProperty.
 */
export function isAssignmentProperty(
  node: AssignmentProperty | RestElement
): node is AssignmentProperty {
  return node.type === 'Property'
}
/**
 * Checks whether the given node is VElement.
 */
export function isVElement(node: ASTNode): node is VElement {
  return node.type === 'VElement'
}

/**
 * Checks whether the given node is in export default.
 */
export function isInExportDefault(node: ASTNode) {
  let parent = node.parent
  while (parent) {
    if (parent.type === 'ExportDefaultDeclaration') {
      return true
    }
    parent = parent.parent
  }
  return false
}

/**
 * Retrieve `TSAsExpression#expression` value if the given node a `TSAsExpression` node. Otherwise, pass through it.
 */
export function skipTSAsExpression<T>(
  node: T | TSAsExpression
): T | TSAsExpression {
  if (!node) {
    return node
  }
  // @ts-expect-error -- dynamic AST shape or visitor key
  return node.type === 'TSAsExpression'
    ? // @ts-expect-error -- dynamic AST shape or visitor key
      skipTSAsExpression(node.expression)
    : node
}

/**
 * Gets the parent node of the given node. This method returns a value ignoring `X as F`.
 */
function getParent(node: Expression) {
  let parent = node.parent
  while (parent.type === 'TSAsExpression') {
    parent = parent.parent
  }
  return parent
}

/**
 * Checks if the given node is a property value.
 */
export function isPropertyChain(prop: Property, node: Expression) {
  let value = node
  while (value.parent.type === 'TSAsExpression') {
    value = value.parent
  }
  return prop === value.parent && prop.value === value
}

/**
 * Retrieve `AssignmentPattern#left` value if the given node a `AssignmentPattern` node. Otherwise, pass through it.
 */
export function skipDefaultParamValue(
  node: Pattern | undefined
): Exclude<Pattern, AssignmentPattern> | undefined {
  if (!node) {
    return node
  }
  return node.type === 'AssignmentPattern'
    ? skipDefaultParamValue(node.left)
    : node
}

/**
 * Retrieve `ChainExpression#expression` value if the given node a `ChainExpression` node. Otherwise, pass through it.
 */
export function skipChainExpression<T>(
  node: T | ChainExpression
): T | ChainExpression {
  if (!node) {
    return node
  }
  // @ts-expect-error -- dynamic AST shape or visitor key
  return node.type === 'ChainExpression'
    ? // @ts-expect-error -- dynamic AST shape or visitor key
      skipChainExpression(node.expression)
    : node
}

/**
 * Checks whether the given node is in a type annotation.
 */
export function isWithinTypeNode(node: ESNode) {
  let target: ASTNode | null = node
  while (target) {
    if (isTypeNode(target)) {
      return true
    }
    target = target.parent
  }
  return false
}

/**
 * Gets the property name of a given node.
 */
export function getStaticPropertyName(
  node: Property | AssignmentProperty | MethodDefinition | MemberExpression
) {
  if (node.type === 'Property' || node.type === 'MethodDefinition') {
    if (!node.computed) {
      const key = node.key
      if (key.type === 'Identifier') {
        return key.name
      }
    }
    const key = node.key
    return getStringLiteralValue(key)
  }
  if (node.type === 'MemberExpression') {
    if (!node.computed) {
      const property = node.property
      return property.type === 'Identifier' ? property.name : null
    }
    const property = node.property
    return getStringLiteralValue(property)
  }
  return null
}

/**
 * Gets the string of a given node.
 */
export function getStringLiteralValue(
  node: ASTNode,
  shouldUseStringOnly?: boolean
) {
  if (node.type === 'Literal') {
    if (node.value == null) {
      return shouldUseStringOnly || node.bigint == null ? null : node.bigint
    }
    if (typeof node.value === 'string') {
      return node.value
    }
    return shouldUseStringOnly ? null : String(node.value)
  }
  return node.type === 'TemplateLiteral' &&
    node.expressions.length === 0 &&
    node.quasis.length === 1
    ? node.quasis[0].value.cooked
    : null
}

/**
 * Gets the name parameter from the given call expression.
 */
export function getNameParamNode(node: CallExpression) {
  const nameLiteralNode = node.arguments[0]
  if (nameLiteralNode && isStringLiteral(nameLiteralNode)) {
    const name = getStringLiteralValue(nameLiteralNode)
    if (name != null) {
      return { name, loc: nameLiteralNode.loc, range: nameLiteralNode.range }
    }
  }
  return null
}
/**
 * Gets the VExpressionContainer of a given node.
 */
function getVExpressionContainer(node: ASTNode) {
  let n: ASTNode | null = node
  while (n && n.type !== 'VExpressionContainer') {
    n = n.parent
  }
  return n
}

export function isTypeScriptFile(path: string) {
  return path.endsWith('.ts') || path.endsWith('.tsx') || path.endsWith('.mts')
}

// ------------------------------------------------------------------------------
// Vue Helpers
// ------------------------------------------------------------------------------

export function isVueFile(path: string) {
  return path.endsWith('.vue') || path.endsWith('.jsx') || path.endsWith('.tsx')
}

/**
 * Checks whether the current file is uses `<script setup>`
 */
export function isScriptSetup(context: RuleContext) {
  return Boolean(getScriptSetupElement(context))
}
/**
 * Gets the element of `<script setup>`
 */
export function getScriptSetupElement(context: RuleContext): VElement | null {
  const sourceCode = context.sourceCode
  const df =
    sourceCode.parserServices.getDocumentFragment &&
    sourceCode.parserServices.getDocumentFragment()
  if (!df) {
    return null
  }
  const scripts = df.children.filter(
    (e): e is VElement => isVElement(e) && e.name === 'script'
  )
  if (scripts.length === 2) {
    return scripts.find((e: any) => hasAttribute(e, 'setup')) || null
  }
  const script = scripts[0]
  return script && hasAttribute(script, 'setup') ? script : null
}

/**
 * Check whether the given node is a Vue component based
 * on the filename and default export type
 * export default {} in .vue || .jsx
 */
function isVueComponentFile(node: ESNode, path: string) {
  return (
    isVueFile(path) &&
    node.type === 'ExportDefaultDeclaration' &&
    node.declaration.type === 'ObjectExpression'
  )
}

/**
 * Whether the given callee refers to a symbol exported by Vue.
 */
function isGlobalOrImportedFromVue(callee: Identifier, context: RuleContext) {
  const globalScope = context.sourceCode.scopeManager.globalScope

  if (globalScope === null) {
    return true
  }

  const tracker = new ReferenceTracker(
    globalScope as unknown as ConstructorParameters<typeof ReferenceTracker>[0]
  )

  const globalTraceMap = {
    [callee.name]: {
      [ReferenceTracker.CALL]: true
    }
  }
  const cjsTraceMap = createCompositionApiTraceMap(globalTraceMap)
  const esmTraceMap = createCompositionApiTraceMap({
    [ReferenceTracker.ESM]: true,
    [callee.name]: {
      [ReferenceTracker.CALL]: true
    }
  })

  function* allReferences() {
    yield* tracker.iterateGlobalReferences(
      globalTraceMap
    ) as unknown as WithVue<ReturnType<typeof tracker.iterateGlobalReferences>>
    yield* tracker.iterateEsmReferences(esmTraceMap) as unknown as WithVue<
      ReturnType<typeof tracker.iterateEsmReferences>
    >
    yield* tracker.iterateCjsReferences(cjsTraceMap) as unknown as WithVue<
      ReturnType<typeof tracker.iterateCjsReferences>
    >
  }

  for (const { node } of allReferences()) {
    if (node === callee.parent) {
      return true
    }
  }

  // No references found
  // The callee is either from a different source, or it is injected
  // (e.g., <script>defineComponent({})</script>).

  const variable = (findVariable as unknown as WithVue<typeof findVariable>)(
    getScope(context, callee),
    callee
  )

  if (variable !== null && variable.defs.length === 1) {
    const def = variable.defs[0]

    const vueLikePackageNames = new Set(['vue'])

    // import { name } from 'not-vue'
    if (
      def.type === 'ImportBinding' &&
      def.node.type === 'ImportSpecifier' &&
      def.node.imported.type === 'Identifier' &&
      def.node.parent.type === 'ImportDeclaration'
    ) {
      return vueLikePackageNames.has(def.node.parent.source.value)
    }

    // const { name } = ...
    if (
      def.type === 'Variable' &&
      def.node.id.type === 'ObjectPattern' &&
      def.node.init !== null
    ) {
      const init = def.node.init

      // const { name } = require('something')
      if (init.type === 'CallExpression') {
        const firstArg = init.arguments[0]

        if (
          init.callee.type === 'Identifier' &&
          init.callee.name === 'require'
        ) {
          const source = isStringLiteral(firstArg)
            ? getStringLiteralValue(firstArg)
            : null

          return source !== null && vueLikePackageNames.has(source)
        }
      }
    }

    // try {} catch (name) {}
    // class name {}
    // function name() {}
    // name(); let name = ...
    if (
      ['CatchClause', 'ClassName', 'FunctionName', 'TDZ'].includes(def.type)
    ) {
      return false
    }
  }

  // Can't determine the source, default to true.
  return true
}

/**
 * Get the Vue component definition type from given node
 * Vue.component('xxx', {}) || component('xxx', {})
 */
export function getVueComponentDefinitionType(
  context: RuleContext,
  node: ObjectExpression
) {
  const parent = getParent(node)
  if (parent.type === 'CallExpression') {
    const callee = parent.callee

    if (callee.type === 'MemberExpression') {
      const calleeObject = skipTSAsExpression(callee.object)

      if (calleeObject.type === 'Identifier') {
        const propName = getStaticPropertyName(callee)
        // app.component('xxx', {}) || app.mixin({})
        const maybeFullVueComponent = propName && isObjectArgument(parent)

        return maybeFullVueComponent &&
          (propName === 'component' || propName === 'mixin')
          ? propName
          : null
      }
    } else if (callee.type === 'Identifier') {
      if (callee.name === 'defineNuxtComponent') {
        // for Nuxt 3.x
        // defineNuxtComponent({})
        const isDestructedVueComponent = isObjectArgument(parent)
        return isDestructedVueComponent ? 'defineNuxtComponent' : null
      }

      if (
        // createApp({}) || defineComponent({})
        (callee.name === 'createApp' || callee.name === 'defineComponent') &&
        isGlobalOrImportedFromVue(callee, context)
      ) {
        return isObjectArgument(parent) ? callee.name : null
      }
    }
  }

  return null
}

function isObjectArgument(node: CallExpression) {
  const lastArgument = node.arguments.at(-1)
  return (
    lastArgument && skipTSAsExpression(lastArgument).type === 'ObjectExpression'
  )
}

/**
 * Check whether given node is new Vue instance
 * new Vue({})
 */
function isVueInstance(node: NewExpression) {
  const callee = node.callee
  return (
    node.type === 'NewExpression' &&
    callee.type === 'Identifier' &&
    callee.name === 'Vue' &&
    node.arguments.length > 0 &&
    skipTSAsExpression(node.arguments[0]).type === 'ObjectExpression'
  )
}

/**
 * If the given object is a Vue component or instance, returns the Vue definition type.
 */
export function getVueObjectType(context: RuleContext, node: ObjectExpression) {
  if (node.type !== 'ObjectExpression') {
    return null
  }
  const parent = getParent(node)
  switch (parent.type) {
    case 'ExportDefaultDeclaration': {
      // export default {} in .vue || .jsx
      const filePath = context.filename
      if (
        isVueComponentFile(parent, filePath) &&
        skipTSAsExpression(parent.declaration) === node
      ) {
        const scriptSetup = getScriptSetupElement(context)
        return scriptSetup &&
          scriptSetup.range[0] <= parent.range[0] &&
          parent.range[1] <= scriptSetup.range[1]
          ? null // `export default` in `<script setup>`
          : 'export'
      }

      break
    }
    case 'CallExpression': {
      // Vue.component('xxx', {}) || component('xxx', {})
      if (
        getVueComponentDefinitionType(context, node) != null &&
        skipTSAsExpression(parent.arguments.at(-1)) === node
      ) {
        return 'definition'
      }

      break
    }
    case 'NewExpression': {
      // new Vue({})
      if (
        isVueInstance(parent) &&
        skipTSAsExpression(parent.arguments[0]) === node
      ) {
        return 'instance'
      }

      break
    }
    // No default
  }
  return getComponentComments(context).some(
    (el: any) => el.loc.end.line === node.loc.start.line - 1
  )
    ? 'mark'
    : null
}

/**
 * Checks whether the given object is an SFC definition.
 */
export function isSFCObject(context: RuleContext, node: ObjectExpression) {
  if (node.type !== 'ObjectExpression') {
    return false
  }
  const filePath = context.filename
  const ext = path.extname(filePath)
  return (ext === '.vue' || !ext) && isSFC(node)

  function isSFC(node: Expression): boolean {
    const parent = getParent(node)
    switch (parent.type) {
      case 'ExportDefaultDeclaration': {
        // export default {}
        if (skipTSAsExpression(parent.declaration) !== node) {
          return false
        }
        const scriptSetup = getScriptSetupElement(context)
        // `false` for `export default` in `<script setup>`
        return (
          !scriptSetup ||
          scriptSetup.range[0] > parent.range[0] ||
          parent.range[1] > scriptSetup.range[1]
        )
      }
      case 'CallExpression': {
        if (
          parent.arguments.every((arg: any) => skipTSAsExpression(arg) !== node)
        ) {
          return false
        }
        const { callee } = parent
        return (
          ((callee.type === 'Identifier' &&
            (callee.name === 'defineComponent' ||
              callee.name === 'defineNuxtComponent')) ||
            (callee.type === 'MemberExpression' &&
              callee.object.type === 'Identifier' &&
              callee.object.name === 'Vue' &&
              callee.property.type === 'Identifier' &&
              callee.property.name === 'extend')) &&
          isSFC(parent)
        )
      }
      case 'VariableDeclarator': {
        if (
          skipTSAsExpression(parent.init) !== node ||
          parent.id.type !== 'Identifier'
        ) {
          return false
        }
        const variable = (
          findVariable as unknown as WithVue<typeof findVariable>
        )(getScope(context, node), parent.id)
        return variable
          ? variable.references.some(
              (ref) =>
                ref.identifier.type === 'Identifier' && isSFC(ref.identifier)
            )
          : false
      }
      // No default
    }
    return false
  }
}

/**
 * Gets the component comments of a given context.
 */
function getComponentComments(context: RuleContext) {
  let tokens = componentComments.get(context)
  if (tokens) {
    return tokens
  }
  const sourceCode = context.sourceCode
  tokens = sourceCode
    .getAllComments()
    .filter((comment: any) => /@vue\/component/g.test(comment.value))
  componentComments.set(context, tokens)
  return tokens
}

/**
 * Return generator with the all handler nodes defined in the given watcher property.
 */
export function* iterateWatchHandlerValues(
  property: Property | Expression
): Generator<Expression> {
  const value = property.type === 'Property' ? property.value : property
  if (value.type === 'ObjectExpression') {
    const handler = findProperty(value, 'handler')
    if (handler) {
      yield handler.value
    }
  } else if (value.type === 'ArrayExpression') {
    for (const element of value.elements) {
      if (isDef(element) && element.type !== 'SpreadElement') {
        yield* iterateWatchHandlerValues(element)
      }
    }
  } else {
    yield value
  }
}

/**
 * Wraps composition API trace map in 'vue' and '#imports' from unimport
 */
export function createCompositionApiTraceMap(
  map: import('@eslint-community/eslint-utils').TraceMap<unknown>
) {
  return {
    vue: map,
    '#imports': map
  }
}

/**
 * Get the attribute which has the given name.
 */
export function getAttribute(node: VElement, name: string, value?: string) {
  return (
    node.startTag.attributes.find(
      (node: VAttribute | VDirective): node is VAttribute =>
        !node.directive &&
        node.key.name === name &&
        (value === undefined ||
          (node.value != null && node.value.value === value))
    ) || null
  )
}

/**
 * Get the directive list which has the given name.
 */
export function getDirectives(node: VElement | VStartTag, name: string) {
  const attributes = (node.type === 'VElement' ? node.startTag : node)
    .attributes
  return attributes.filter(
    (node: VAttribute | VDirective): node is VDirective =>
      node.directive && node.key.name.name === name
  )
}
/**
 * Get the directive which has the given name.
 */
export function getDirective(node: VElement, name: string, argument?: string) {
  return (
    node.startTag.attributes.find(
      (node: VAttribute | VDirective): node is VDirective =>
        node.directive &&
        node.key.name.name === name &&
        (argument === undefined ||
          (node.key.argument &&
            node.key.argument.type === 'VIdentifier' &&
            node.key.argument.name) === argument)
    ) || null
  )
}

/**
 * Check whether the given start tag has specific directive.
 */
export function hasAttribute(node: VElement, name: string, value?: string) {
  return Boolean(getAttribute(node, name, value))
}

/**
 * Check whether the given start tag has specific directive.
 */
export function hasDirective(node: VElement, name: string, argument?: string) {
  return Boolean(getDirective(node, name, argument))
}

/**
 * Check whether the given directive node is v-bind same-name shorthand.
 */
export function isVBindSameNameShorthand(
  node: VAttribute | VDirective
): node is VDirective & {
  value: VExpressionContainer & { expression: Identifier }
} {
  return (
    node.directive &&
    node.key.name.name === 'bind' &&
    node.value?.expression?.type === 'Identifier' &&
    node.key.range[0] <= node.value.range[0] &&
    node.value.range[1] <= node.key.range[1]
  )
}

export function isStringLiteral(
  node: ASTNode
): node is
  (Literal & { value: string }) | (TemplateLiteral & { expressions: [] }) {
  return (
    (node.type === 'Literal' && typeof node.value === 'string') ||
    (node.type === 'TemplateLiteral' && node.expressions.length === 0)
  )
}

/**
 * Checks whether given defineProps call node has withDefaults.
 */
export function hasWithDefaults(
  node: CallExpression
): node is CallExpression & { parent: CallExpression } {
  return (
    node.parent &&
    node.parent.type === 'CallExpression' &&
    node.parent.arguments[0] === node &&
    node.parent.callee.type === 'Identifier' &&
    node.parent.callee.name === 'withDefaults'
  )
}

/**
 * Get the withDefaults call node from given defineProps call node.
 */
function getWithDefaults(node: CallExpression) {
  return hasWithDefaults(node) ? node.parent : null
}

/**
 * Gets a map of the property nodes defined in withDefaults.
 */
export function getWithDefaultsProps(
  node: CallExpression
): Record<string, Property> {
  if (!hasWithDefaults(node)) {
    return {}
  }
  const param = node.parent.arguments[1]
  if (!param || param.type !== 'ObjectExpression') {
    return {}
  }

  const result: Record<string, Property> = {}

  for (const prop of param.properties) {
    if (prop.type !== 'Property') {
      continue
    }
    const name = getStaticPropertyName(prop)
    if (name != null) {
      result[name] = prop
    }
  }

  return result
}

/**
 * Gets the props destructure property nodes for defineProp.
 */
export function getPropsDestructure(node: CallExpression) {
  const result: Record<string, AssignmentProperty> = Object.create(null)
  const left = getLeftOfDefineProps(node)
  if (!left || left.type !== 'ObjectPattern') {
    return result
  }
  for (const prop of left.properties) {
    if (prop.type !== 'Property') continue
    const name = getStaticPropertyName(prop)
    if (name != null) {
      result[name] = prop
    }
  }
  return result
}

/**
 * Gets the default definition nodes for defineProp
 * using the props destructure with assignment pattern.
 */
export function getDefaultPropExpressionsForPropsDestructure(
  node: CallExpression
) {
  const result = Object.create(null)
  const propsDestructureEntries = Object.entries(getPropsDestructure(node))
  for (const [name, prop] of propsDestructureEntries) {
    if (!prop) continue
    const value = prop.value
    if (value.type !== 'AssignmentPattern') continue
    result[name] = { prop, expression: value.right }
  }
  return result
}

/**
 * Gets the pattern of the left operand of defineProps.
 */
export function getLeftOfDefineProps(node: CallExpression) {
  let target = node
  if (hasWithDefaults(target)) {
    target = target.parent
  }
  if (!target.parent) {
    return null
  }
  return target.parent.type === 'VariableDeclarator' &&
    target.parent.init === target
    ? target.parent.id
    : null
}

/**
 * Get all props from component options object.
 */
export function getComponentPropsFromOptions(
  componentObject: ObjectExpression
): (ComponentArrayProp | ComponentObjectProp | ComponentUnknownProp)[] {
  const propsNode = componentObject.properties.find(
    (p: ESNode): p is Property & { key: Identifier & { name: 'props' } } =>
      p.type === 'Property' && getStaticPropertyName(p) === 'props'
  )

  if (!propsNode) {
    return []
  }
  if (
    propsNode.value.type !== 'ObjectExpression' &&
    propsNode.value.type !== 'ArrayExpression'
  ) {
    return [
      {
        type: 'unknown',
        propName: null,
        node: propsNode.value
      }
    ]
  }

  return getComponentPropsFromDefine(propsNode.value) as (
    ComponentArrayProp | ComponentObjectProp | ComponentUnknownProp
  )[]
}

/**
 * Get all emits from component options object.
 */
export function getComponentEmitsFromOptions(
  componentObject: ObjectExpression
): ComponentEmit[] {
  const emitsNode = componentObject.properties.find(
    (p): p is Property =>
      p.type === 'Property' && getStaticPropertyName(p) === 'emits'
  )

  if (!emitsNode) {
    return []
  }
  if (
    emitsNode.value.type !== 'ObjectExpression' &&
    emitsNode.value.type !== 'ArrayExpression'
  ) {
    return [
      {
        type: 'unknown',
        emitName: null,
        node: emitsNode.value
      }
    ]
  }

  return getComponentEmitsFromDefine(emitsNode.value) as ComponentEmit[]
}

/**
 * Get all props from `defineProps` call expression.
 */
function getComponentPropsFromDefineProps(
  context: RuleContext,
  node: CallExpression
) {
  if (node.arguments.length > 0) {
    const defNode = getObjectOrArray(context, node.arguments[0])
    if (defNode) {
      return getComponentPropsFromDefine(defNode)
    }
    return [
      {
        type: 'unknown',
        propName: null,
        node: node.arguments[0]
      }
    ]
  }
  const typeArguments = node.typeArguments
  if (typeArguments && typeArguments.params.length > 0) {
    return getComponentPropsFromTypeDefine(context, typeArguments.params[0])
  }
  return [
    {
      type: 'unknown',
      propName: null,
      node: null
    }
  ]
}

/**
 * Get all emits from `defineEmits` call expression.
 */
function getComponentEmitsFromDefineEmits(
  context: RuleContext,
  node: CallExpression
): ComponentEmit[] {
  if (node.arguments.length > 0) {
    const defNode = getObjectOrArray(context, node.arguments[0])
    if (defNode) {
      return getComponentEmitsFromDefine(defNode) as ComponentEmit[]
    }
    return [
      {
        type: 'unknown',
        emitName: null,
        node: node.arguments[0]
      }
    ]
  }
  const typeArguments = node.typeArguments
  if (typeArguments && typeArguments.params.length > 0) {
    return getComponentEmitsFromTypeDefine(
      context,
      typeArguments.params[0]
    ) as unknown as ComponentEmit[]
  }
  return [
    {
      type: 'unknown',
      emitName: null,
      node: null
    }
  ]
}

/**
 * Get all slots from `defineSlots` call expression.
 */
function getComponentSlotsFromDefineSlots(
  context: RuleContext,
  node: CallExpression
) {
  const typeArguments = node.typeArguments
  if (typeArguments && typeArguments.params.length > 0) {
    return getComponentSlotsFromTypeDefine(context, typeArguments.params[0])
  }
  return [
    {
      type: 'unknown',
      slotName: null,
      node: null
    }
  ]
}

/**
 * Get model info from `defineModel` call expression.
 */
function getComponentModelFromDefineModel(
  _context: RuleContext,
  node: CallExpression
) {
  let name: { modelName: string; node: Literal | null } = {
    modelName: 'modelValue',
    node: null
  }

  let options =
    node.arguments[0]?.type === 'SpreadElement' ? null : node.arguments[0]
  if (node.arguments.length > 0) {
    const nameNodeCandidate = skipTSAsExpression(node.arguments[0])
    if (nameNodeCandidate.type === 'Literal') {
      name = {
        modelName: String(nameNodeCandidate.value),
        node: nameNodeCandidate
      }
      options =
        node.arguments[1]?.type === 'SpreadElement' ? null : node.arguments[1]
    }
  }

  const typeArguments = node.typeArguments
  if (typeArguments && typeArguments.params.length > 0) {
    return {
      name,
      options,
      typeNode: typeArguments.params[0]
    }
  }
  return {
    name,
    options,
    typeNode: null
  }
}

/**
 * Get all props by looking at all component's properties
 */
function getComponentPropsFromDefine(
  propsNode: ObjectExpression | ArrayExpression
) {
  if (propsNode.type === 'ObjectExpression') {
    return propsNode.properties.map((prop: any) => {
      if (!isProperty(prop)) {
        return {
          type: 'unknown',
          propName: null,
          node: prop
        }
      }
      const propName = getStaticPropertyName(prop)
      if (propName != null) {
        return {
          type: 'object',
          key: prop.key,
          propName,
          value: skipTSAsExpression(prop.value),
          node: prop
        }
      }
      return {
        type: 'object',
        key: null,
        propName: null,
        value: skipTSAsExpression(prop.value),
        node: prop
      }
    })
  }

  return propsNode.elements.filter(isDef).map((prop: any) => {
    if (prop.type === 'Literal' || prop.type === 'TemplateLiteral') {
      const propName = getStringLiteralValue(prop)
      if (propName != null) {
        return {
          type: 'array',
          key: prop,
          propName,
          value: null,
          node: prop
        }
      }
    }
    return {
      type: 'array',
      key: null,
      propName: null,
      value: null,
      node: prop
    }
  })
}

/**
 * Get all emits by looking at all component's properties
 */
function getComponentEmitsFromDefine(
  emitsNode: ObjectExpression | ArrayExpression
) {
  if (emitsNode.type === 'ObjectExpression') {
    return emitsNode.properties.map((prop: any) => {
      if (!isProperty(prop)) {
        return {
          type: 'unknown',
          key: null,
          emitName: null,
          value: null,
          node: prop
        }
      }
      const emitName = getStaticPropertyName(prop)
      if (emitName != null) {
        return {
          type: 'object',
          key: prop.key,
          emitName,
          value: skipTSAsExpression(prop.value),
          node: prop
        }
      }
      return {
        type: 'object',
        key: null,
        emitName: null,
        value: skipTSAsExpression(prop.value),
        node: prop
      }
    })
  }

  return emitsNode.elements.filter(isDef).map((emit: any) => {
    if (emit.type === 'Literal' || emit.type === 'TemplateLiteral') {
      const emitName = getStringLiteralValue(emit)
      if (emitName != null) {
        return {
          type: 'array',
          key: emit,
          emitName,
          value: null,
          node: emit
        }
      }
    }
    return {
      type: 'array',
      key: null,
      emitName: null,
      value: null,
      node: emit
    }
  })
}

function getObjectOrArray(context: RuleContext, node: ESNode) {
  if (node.type === 'ObjectExpression') {
    return node
  }
  if (node.type === 'ArrayExpression') {
    return node
  }
  if (node.type === 'Identifier') {
    const variable = (findVariable as unknown as WithVue<typeof findVariable>)(
      getScope(context, node),
      node
    )

    if (variable != null && variable.defs.length === 1) {
      const def = variable.defs[0]
      if (
        def.type === 'Variable' &&
        def.parent.kind === 'const' &&
        def.node.id.type === 'Identifier' &&
        def.node.init
      ) {
        return getObjectOrArray(context, def.node.init)
      }
    }
  }
  return null
}
