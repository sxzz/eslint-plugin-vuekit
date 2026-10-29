/**
 * @fileoverview enforce usage of `exact` modifier on `v-on`.
 * @author Armano
 */
import type {
  RuleContext,
  SourceCode,
  VDirectiveKey,
  VStartTag
} from '../types/index.ts'
import type { RuleDefinition, PublicRuleModule } from '../types/rule.ts'

export type EventDirective = {
  name: string
  node: VDirectiveKey
  modifiers: string[]
  hasHandler: boolean
}

import {
  getDirectives,
  defineTemplateBodyVisitor,
  isCustomComponent as utilsIsCustomComponent
} from '../utils/index.ts'

const SYSTEM_MODIFIERS = new Set(['ctrl', 'shift', 'alt', 'meta'])
const GLOBAL_MODIFIERS = new Set([
  'stop',
  'prevent',
  'capture',
  'self',
  'once',
  'passive',
  'native'
])
const KEYBOARD_EVENTS = new Set(['keydown', 'keypress', 'keyup'])

/**
 * Finds and returns all keys for event directives
 */
function getEventDirectives(startTag: VStartTag, sourceCode: SourceCode) {
  return getDirectives(startTag, 'on').map((attribute: any) => ({
    name: attribute.key.argument
      ? sourceCode.getText(attribute.key.argument)
      : '',
    node: attribute.key,
    modifiers: attribute.key.modifiers.map((modifier: any) => modifier.name),
    hasHandler: Boolean(attribute.value)
  }))
}

/**
 * Checks whether given modifier is key modifier
 */
function isKeyModifier(modifier: string) {
  return !GLOBAL_MODIFIERS.has(modifier) && !SYSTEM_MODIFIERS.has(modifier)
}

/**
 * Checks whether given modifier is system one
 */
function isSystemModifier(modifier: string) {
  return SYSTEM_MODIFIERS.has(modifier)
}

/**
 * Checks whether given any of provided modifiers
 * has system modifier
 */
function hasSystemModifier(modifiers: string[]) {
  return modifiers.some(isSystemModifier)
}

/**
 * Checks whether the event catches every key event to stop propagation,
 * only applies global modifiers, and has no handler.
 */
function isGlobalOnlyKeyboardStopEvent(event: EventDirective) {
  return (
    KEYBOARD_EVENTS.has(event.name) &&
    event.modifiers.includes('stop') &&
    !event.hasHandler &&
    event.modifiers.every((modifier: any) => GLOBAL_MODIFIERS.has(modifier))
  )
}

/**
 * Groups all events in object,
 * with keys represinting each event name
 */
function groupEvents(events: EventDirective[]) {
  const grouped: Record<string, EventDirective[]> = {}
  for (const event of events) {
    if (!grouped[event.name]) {
      grouped[event.name] = []
    }
    grouped[event.name].push(event)
  }
  return grouped
}

/**
 * Creates alphabetically sorted string with system modifiers
 */
function getSystemModifiersString(modifiers: string[]) {
  return modifiers
    .filter(isSystemModifier)
    .sort((a: any, b: any) => a.localeCompare(b))
    .join(',')
}

/**
 * Creates alphabetically sorted string with key modifiers
 */
function getKeyModifiersString(modifiers: string[]) {
  return modifiers
    .filter(isKeyModifier)
    .sort((a: any, b: any) => a.localeCompare(b))
    .join(',')
}

/**
 * Compares two events based on their modifiers
 * to detect possible event leakeage
 */
function hasConflictedModifiers(
  baseEvent: EventDirective,
  event: EventDirective
) {
  if (event.node === baseEvent.node || event.modifiers.includes('exact'))
    return false

  if (
    baseEvent.modifiers.includes('exact') &&
    isGlobalOnlyKeyboardStopEvent(event)
  )
    return false

  const eventKeyModifiers = getKeyModifiersString(event.modifiers)
  const baseEventKeyModifiers = getKeyModifiersString(baseEvent.modifiers)

  if (
    eventKeyModifiers &&
    baseEventKeyModifiers &&
    eventKeyModifiers !== baseEventKeyModifiers
  )
    return false

  const eventSystemModifiers = getSystemModifiersString(event.modifiers)
  const baseEventSystemModifiers = getSystemModifiersString(baseEvent.modifiers)

  return (
    baseEvent.modifiers.length > 0 &&
    baseEventSystemModifiers !== eventSystemModifiers &&
    baseEventSystemModifiers.includes(eventSystemModifiers)
  )
}

/**
 * Searches for events that might conflict with each other
 */
function findConflictedEvents(events: EventDirective[]) {
  const conflictedEvents: EventDirective[] = []
  for (const event of events) {
    conflictedEvents.push(
      ...events
        .filter((evt: any) => !conflictedEvents.includes(evt)) // No duplicates
        .filter(hasConflictedModifiers.bind(null, event))
    )
  }
  return conflictedEvents
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'enforce usage of `exact` modifier on `v-on`',
      categories: ['vue3-essential'],
      url: 'https://eslint-plugin-vuekit.sxzz.dev/rules/use-v-on-exact.html'
    },
    schema: [],
    messages: {
      considerExact: "Consider to use '.exact' modifier."
    }
  },

  /**
   * Creates AST event handlers for use-v-on-exact.
   */
  create(context: RuleContext) {
    const sourceCode = context.sourceCode

    return defineTemplateBodyVisitor(context, {
      VStartTag(node: VStartTag) {
        if (node.attributes.length === 0) return

        const isCustomComponent = utilsIsCustomComponent(node.parent)
        let events = getEventDirectives(node, sourceCode)

        if (isCustomComponent) {
          // For components consider only events with `native` modifier
          events = events.filter((event: any) =>
            event.modifiers.includes('native')
          )
        }

        const grouppedEvents = groupEvents(events)

        for (const eventsInGroup of Object.values(grouppedEvents)) {
          const hasEventWithKeyModifier = eventsInGroup.some((event: any) =>
            hasSystemModifier(event.modifiers)
          )

          if (!hasEventWithKeyModifier) continue

          const conflictedEvents = findConflictedEvents(eventsInGroup)

          for (const e of conflictedEvents) {
            context.report({
              node: e.node,
              loc: e.node.loc,
              messageId: 'considerExact'
            })
          }
        }
      }
    })
  }
} satisfies RuleDefinition

export default rule as typeof rule & PublicRuleModule
