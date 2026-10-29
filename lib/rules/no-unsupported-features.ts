/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  RuleContext,
  RuleListener,
  TemplateListener
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'
import { isRangeSubset, parseRange, type SemVerRange } from 'verkit'
import {
  compositingVisitors,
  defineTemplateBodyVisitor
} from '../utils/index.ts'
import styleCssVarsInjection from './syntaxes/style-css-vars-injection.ts'
import isAttributeWithVuePrefix from './syntaxes/is-attribute-with-vue-prefix.ts'
import vMemo from './syntaxes/v-memo.ts'
import vBindPropModifierShorthand from './syntaxes/v-bind-prop-modifier-shorthand.ts'
import vBindAttrModifier from './syntaxes/v-bind-attr-modifier.ts'
import defineOptions from './syntaxes/define-options.ts'
import defineSlots from './syntaxes/define-slots.ts'
import defineModel from './syntaxes/define-model.ts'
import vBindSameNameShorthand from './syntaxes/v-bind-same-name-shorthand.ts'

interface SyntaxRule {
  supported: string
  createTemplateBodyVisitor?: (context: RuleContext) => TemplateListener
  createScriptVisitor?: (context: RuleContext) => RuleListener
}

const FEATURES = {
  // Vue.js 3.0.3+
  'style-css-vars-injection': styleCssVarsInjection,
  // Vue.js 3.1.0+
  'is-attribute-with-vue-prefix': isAttributeWithVuePrefix,
  // Vue.js 3.2.0+
  'v-memo': vMemo,
  'v-bind-prop-modifier-shorthand': vBindPropModifierShorthand,
  'v-bind-attr-modifier': vBindAttrModifier,
  // Vue.js 3.3.0+
  'define-options': defineOptions,
  'define-slots': defineSlots,
  // Vue.js 3.4.0+
  'define-model': defineModel,
  'v-bind-same-name-shorthand': vBindSameNameShorthand
} satisfies Record<string, SyntaxRule>

const SYNTAX_NAMES = Object.keys(FEATURES) as (keyof typeof FEATURES)[]

const cache = new Map<string, SemVerRange>()

/** Parse and cache a version range. */
function getSemverRange(range: string): SemVerRange {
  let parsed = cache.get(range)
  if (!parsed) {
    parsed = parseRange(range)
    cache.set(range, parsed)
  }
  return parsed
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'disallow unsupported Vue.js syntax on the specified version',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-unsupported-features.html'
    },

    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          version: {
            type: 'string'
          },
          ignores: {
            type: 'array',
            items: {
              enum: SYNTAX_NAMES
            },
            uniqueItems: true
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      // Vue.js 3.0.3+
      forbiddenStyleCssVarsInjection:
        'SFC CSS variable injection is not supported until Vue.js "3.0.3".',
      // Vue.js 3.1.0+
      forbiddenIsAttributeWithVuePrefix:
        '`is="vue:"` are not supported until Vue.js "3.1.0".',
      // Vue.js 3.2.0+
      forbiddenVMemo: '`v-memo` are not supported until Vue.js "3.2.0".',
      forbiddenVBindPropModifierShorthand:
        '`.prop` shorthand are not supported until Vue.js "3.2.0".',
      forbiddenVBindAttrModifier:
        '`.attr` modifiers on `v-bind` are not supported until Vue.js "3.2.0".',
      // Vue.js 3.3.0+
      forbiddenDefineOptions:
        '`defineOptions()` macros are not supported until Vue.js "3.3.0".',
      forbiddenDefineSlots:
        '`defineSlots()` macros are not supported until Vue.js "3.3.0".',
      // Vue.js 3.4.0+
      forbiddenDefineModel:
        '`defineModel()` macros are not supported until Vue.js "3.4.0".',
      forbiddenVBindSameNameShorthand:
        '`v-bind` same-name shorthand is not supported until Vue.js "3.4.0".'
    }
  },
  create(context: RuleContext) {
    const { version, ignores } = Object.assign(
      {
        version: null,
        ignores: []
      },
      context.options[0] || {}
    )
    if (!version) {
      // version is not set.
      return {}
    }
    const versionRange = getSemverRange(version)

    /**
     * Check whether a given case object is full-supported on the configured node version.
     */
    function isNotSupportingVersion(aCase: SyntaxRule): boolean {
      return !isRangeSubset(versionRange, getSemverRange(aCase.supported))
    }

    let templateBodyVisitor: TemplateListener = {}
    let scriptVisitor: RuleListener = {}

    for (const syntaxName of SYNTAX_NAMES) {
      const syntax: SyntaxRule = FEATURES[syntaxName]
      if (ignores.includes(syntaxName) || !isNotSupportingVersion(syntax)) {
        continue
      }
      if (syntax.createTemplateBodyVisitor) {
        const visitor = syntax.createTemplateBodyVisitor(context)
        templateBodyVisitor = compositingVisitors(templateBodyVisitor, visitor)
      }
      if (!syntax.createScriptVisitor) {
        continue
      }
      const visitor = syntax.createScriptVisitor(context)
      scriptVisitor = compositingVisitors(scriptVisitor, visitor)
    }

    return defineTemplateBodyVisitor(
      context,
      templateBodyVisitor,
      scriptVisitor
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
