/**
 * @fileoverview Prevent overwrite reserved keys
 * @author Armano
 */
import type { RuleContext } from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

import {
  compositingVisitors,
  defineScriptSetupVisitor,
  executeOnVue,
  iterateProperties
} from '../utils/index.ts'
import RESERVED_KEYS from '../utils/vue-reserved.json' with { type: 'json' }

export type GroupName = import('../utils').GroupName

const GROUP_NAMES = [
  'props',
  'computed',
  'data',
  'asyncData',
  'methods',
  'setup'
]

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'disallow overwriting reserved keys',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/no-reserved-keys.html'
    },
    schema: [
      {
        type: 'object',
        properties: {
          reserved: {
            type: 'array',
            items: { type: 'string' }
          },
          groups: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      reserved: "Key '{{name}}' is reserved.",
      startsWithUnderscore:
        "Keys starting with '_' are reserved in '{{name}}' group."
    }
  },

  create(context: RuleContext) {
    const options = context.options[0] || {}
    const reservedKeys = new Set([
      ...RESERVED_KEYS,
      ...(options.reserved || [])
    ])
    const groups = new Set([...GROUP_NAMES, ...(options.groups || [])])

    return compositingVisitors(
      defineScriptSetupVisitor(context, {
        onDefinePropsEnter(_node: any, props: any) {
          for (const prop of props) {
            if (!prop.propName || !reservedKeys.has(prop.propName)) {
              continue
            }

            const { propName, node } = prop
            context.report({
              node,
              messageId: 'reserved',
              data: {
                name: propName
              }
            })
          }
        }
      }),
      executeOnVue(context, (obj: any) => {
        const properties = iterateProperties(obj, groups)
        for (const o of properties) {
          if (
            (o.groupName === 'data' || o.groupName === 'asyncData') &&
            o.name[0] === '_'
          ) {
            context.report({
              node: o.node,
              messageId: 'startsWithUnderscore',
              data: {
                name: o.name
              }
            })
          } else if (reservedKeys.has(o.name)) {
            context.report({
              node: o.node,
              messageId: 'reserved',
              data: {
                name: o.name
              }
            })
          }
        }
      })
    )
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
