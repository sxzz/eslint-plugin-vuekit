/**
 * @author Yosuke Ota <https://github.com/ota-meshi>
 * See LICENSE file in root directory for full license.
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  compositingVisitors,
  getScriptSetupElement,
  defineVueVisitor,
  isSFCObject,
  getStaticPropertyName
} from '../utils/index.ts'

export type PreferOption = 'script-setup' | 'composition' | 'options'
export type UserPreferOption = PreferOption[]
export type NormalizeOptions = {
  allowsSFC: {
    scriptSetup?: boolean
    composition?: boolean
    options?: boolean
  }
  allowsOther: {
    composition?: boolean
    options?: boolean
  }
}

const STYLE_OPTIONS = ['script-setup', 'composition', 'options']

function applyPreferOption(opts: NormalizeOptions, prefer: PreferOption) {
  switch (prefer) {
    case 'script-setup': {
      opts.allowsSFC.scriptSetup = true
      break
    }
    case 'composition': {
      opts.allowsSFC.composition = true
      opts.allowsOther.composition = true
      break
    }
    case 'options': {
      opts.allowsSFC.options = true
      opts.allowsOther.options = true
      break
    }
  }
}

/**
 * Normalize options.
 */
function parseOptions(options: any[]) {
  const opts: NormalizeOptions = { allowsSFC: {}, allowsOther: {} }

  const preferOptions = options[0] || ['script-setup', 'composition']
  for (const prefer of preferOptions) {
    applyPreferOption(opts, prefer)
  }

  if (!opts.allowsOther.composition && !opts.allowsOther.options) {
    opts.allowsOther.composition = true
    opts.allowsOther.options = true
  }

  return opts
}

const OPTIONS_API_OPTIONS = new Set([
  'mixins',
  'extends',
  // state
  'data',
  'computed',
  'methods',
  'watch',
  'provide',
  'inject',
  // lifecycle
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'activated',
  'deactivated',
  'beforeDestroy',
  'beforeUnmount',
  'destroyed',
  'unmounted',
  'render',
  'renderTracked',
  'renderTriggered',
  'errorCaptured',
  // public API
  'expose'
])
const COMPOSITION_API_OPTIONS = new Set(['setup'])

const LIFECYCLE_HOOK_OPTIONS = new Set([
  'beforeCreate',
  'created',
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'activated',
  'deactivated',
  'beforeDestroy',
  'beforeUnmount',
  'destroyed',
  'unmounted',
  'renderTracked',
  'renderTriggered',
  'errorCaptured'
])

export type ApiStyle = 'script-setup' | 'composition' | 'options'

function buildAllowedPhrase(allowsOpt: any) {
  const phrases = []
  if (allowsOpt.scriptSetup) {
    phrases.push('`<script setup>`')
  }
  if (allowsOpt.composition) {
    phrases.push('Composition API')
  }
  if (allowsOpt.options) {
    phrases.push('Options API')
  }
  return phrases.length > 2
    ? `${phrases.slice(0, -1).join(', ')} or ${phrases.at(-1)}`
    : phrases.join(' or ')
}

function isPreferScriptSetup(allowsOpt: any) {
  return allowsOpt.scriptSetup && !allowsOpt.composition && !allowsOpt.options
}

function buildOptionPhrase(name: string) {
  if (LIFECYCLE_HOOK_OPTIONS.has(name)) return `\`${name}\` lifecycle hook`

  return name === 'setup' || name === 'render'
    ? `\`${name}\` function`
    : `\`${name}\` option`
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce component API style',
      categories: undefined,
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/component-api-style.html'
    },
    schema: [
      {
        type: 'array',
        items: {
          enum: STYLE_OPTIONS,
          uniqueItems: true
        },
        minItems: 1
      }
    ],
    messages: {
      disallowScriptSetup:
        '`<script setup>` is not allowed in your project. Use {{allowedApis}} instead.',
      disallowComponentOption:
        '{{disallowedApi}} is not allowed in your project. {{optionPhrase}} is part of the {{disallowedApi}}. Use {{allowedApis}} instead.',
      disallowComponentOptionPreferScriptSetup:
        '{{disallowedApi}} is not allowed in your project. Use `<script setup>` instead.'
    }
  },

  create(context: RuleContext) {
    const options = parseOptions(context.options)

    return compositingVisitors(
      {
        Program() {
          if (options.allowsSFC.scriptSetup) {
            return
          }
          const scriptSetup = getScriptSetupElement(context)
          if (scriptSetup) {
            context.report({
              node: scriptSetup.startTag,
              messageId: 'disallowScriptSetup',
              data: {
                allowedApis: buildAllowedPhrase(options.allowsSFC)
              }
            })
          }
        }
      },
      defineVueVisitor(context, {
        onVueObjectEnter(node: any) {
          const allows = isSFCObject(context, node)
            ? options.allowsSFC
            : options.allowsOther
          if (allows.composition && allows.options) {
            return
          }
          const apis = [
            {
              allow: allows.composition,
              options: COMPOSITION_API_OPTIONS,
              apiName: 'Composition API'
            },
            {
              allow: allows.options,
              options: OPTIONS_API_OPTIONS,
              apiName: 'Options API'
            }
          ]
          for (const prop of node.properties) {
            if (prop.type !== 'Property') {
              continue
            }
            const name = getStaticPropertyName(prop)
            if (!name) {
              continue
            }
            const disallowApi =
              apis.every((api) => !(api.allow && api.options.has(name))) &&
              apis.find((api) => !api.allow && api.options.has(name))

            if (disallowApi) {
              context.report({
                node: prop.key,
                messageId: isPreferScriptSetup(allows)
                  ? 'disallowComponentOptionPreferScriptSetup'
                  : 'disallowComponentOption',
                data: {
                  disallowedApi: disallowApi.apiName,
                  optionPhrase: buildOptionPhrase(name),
                  allowedApis: buildAllowedPhrase(allows)
                }
              })
            }
          }
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
