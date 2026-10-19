import type { RuleContext, TypeNode } from '../../types/index.ts'
import {
  extractRuntimeProps,
  isTSTypeLiteral,
  isTSTypeLiteralOrTSFunctionType,
  extractRuntimeEmits,
  flattenTypeNodes,
  isTSInterfaceBody,
  extractRuntimeSlots
} from './ts-ast.ts'
import {
  getComponentPropsFromTypeDefineTypes,
  getComponentEmitsFromTypeDefineTypes,
  getComponentSlotsFromTypeDefineTypes
} from './ts-types.ts'

export { isTypeNode } from './ts-ast.ts'
export { isExhaustiveSwitch, isRefObjectType } from './ts-types.ts'

export type TSESTreeTypeNode =
  import('@typescript-eslint/types').TSESTree.TypeNode

export type ComponentTypeProp = import('../index').ComponentTypeProp
export type ComponentInferTypeProp = import('../index').ComponentInferTypeProp
export type ComponentUnknownProp = import('../index').ComponentUnknownProp
export type ComponentTypeEmit = import('../index').ComponentTypeEmit
export type ComponentInferTypeEmit = import('../index').ComponentInferTypeEmit
export type ComponentUnknownEmit = import('../index').ComponentUnknownEmit
export type ComponentTypeSlot = import('../index').ComponentTypeSlot
export type ComponentInferTypeSlot = import('../index').ComponentInferTypeSlot
export type ComponentUnknownSlot = import('../index').ComponentUnknownSlot

/**
 * Get all props by looking at all component's properties
 */
export function getComponentPropsFromTypeDefine(
  context: RuleContext,
  propsNode: TypeNode
) {
  const result = []
  for (const defNode of flattenTypeNodes(context, propsNode)) {
    if (isTSInterfaceBody(defNode) || isTSTypeLiteral(defNode)) {
      result.push(...extractRuntimeProps(context, defNode))
    } else {
      result.push(...getComponentPropsFromTypeDefineTypes(context, defNode))
    }
  }
  return result
}

/**
 * Get all emits by looking at all component's properties
 */
export function getComponentEmitsFromTypeDefine(
  context: RuleContext,
  emitsNode: TypeNode
) {
  const result = []
  for (const defNode of flattenTypeNodes(context, emitsNode)) {
    if (
      isTSInterfaceBody(defNode) ||
      isTSTypeLiteralOrTSFunctionType(defNode)
    ) {
      result.push(...extractRuntimeEmits(defNode))
    } else {
      result.push(...getComponentEmitsFromTypeDefineTypes(context, defNode))
    }
  }
  return result
}

/**
 * Get all slots by looking at all component's properties
 */
export function getComponentSlotsFromTypeDefine(
  context: RuleContext,
  slotsNode: TypeNode
) {
  const result = []
  for (const defNode of flattenTypeNodes(context, slotsNode)) {
    if (isTSInterfaceBody(defNode) || isTSTypeLiteral(defNode)) {
      result.push(...extractRuntimeSlots(defNode))
    } else {
      result.push(...getComponentSlotsFromTypeDefineTypes(context, defNode))
    }
  }
  return result
}
