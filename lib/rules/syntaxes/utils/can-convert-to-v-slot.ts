/**
 * @author Yosuke Ota
 * See LICENSE file in root directory for full license.
 */
import type {
  ASTNode,
  ParserServices,
  SourceCode,
  VAttribute,
  VDirective,
  VElement,
  VExpressionContainer,
  VForExpression,
  VVariable
} from '../../../types/index.ts'

import {
  isCustomComponent,
  getAttribute,
  getDirective,
  iterateChildElementsChains,
  equalTokens
} from '../../../utils/index.ts'

export type SlotVForVariables = { expr: VForExpression; variables: VVariable[] }

export type SlotContext = {
  element: VElement
  slot: VAttribute | VDirective | null
  vFor: VDirective | null
  slotVForVars: SlotVForVariables | null
  normalizedName: string
}
/**
 * Checks whether the given element can use v-slot.
 */
export default function canConvertToVSlot(
  element: VElement,
  sourceCode: SourceCode,
  tokenStore: ParserServices.TokenStore
) {
  const ownerElement = element.parent
  if (
    ownerElement.type === 'VDocumentFragment' ||
    !isCustomComponent(ownerElement) ||
    ownerElement.name === 'component'
  ) {
    return false
  }
  const slot = getSlotContext(element, sourceCode)
  return (
    // E.g., <template v-for="x of xs" #one></template>
    !(slot.vFor && !slot.slotVForVars) &&
    !hasSameSlotDirective(ownerElement, slot, sourceCode, tokenStore)
  )
}

function getSlotContext(element: VElement, sourceCode: SourceCode) {
  const slot =
    getAttribute(element, 'slot') || getDirective(element, 'bind', 'slot')
  const vFor = getDirective(element, 'for')
  const slotVForVars = getSlotVForVariableIfUsingIterationVars(slot, vFor)

  return {
    element,
    slot,
    vFor,
    slotVForVars,
    normalizedName: getNormalizedName(slot, sourceCode)
  }
}

/**
 * Gets the `v-for` directive and variable that provide the variables used by the given `slot` attribute.
 */
function getSlotVForVariableIfUsingIterationVars(
  slot: VAttribute | VDirective | null,
  vFor?: VDirective | null
) {
  if (!slot || !slot.directive) {
    return null
  }
  const expr = vFor && vFor.value && vFor.value.expression
  const variables =
    expr?.type === 'VForExpression' &&
    getUsingIterationVars(slot.value, slot.parent.parent)
  return expr && variables && variables.length > 0 ? { expr, variables } : null
}

/**
 * Gets iterative variables if a given expression node is using iterative variables that the element defined.
 */
function getUsingIterationVars(
  expression: VExpressionContainer | null,
  element: VElement
) {
  const vars = []
  if (expression && expression.type === 'VExpressionContainer') {
    for (const { variable } of expression.references) {
      if (
        variable != null &&
        variable.kind === 'v-for' &&
        variable.id.range[0] > element.startTag.range[0] &&
        variable.id.range[1] < element.startTag.range[1]
      ) {
        vars.push(variable)
      }
    }
  }
  return vars
}

/**
 * Get the normalized name of a given `slot` attribute node.
 */
function getNormalizedName(
  slotAttr: VAttribute | VDirective | null,
  sourceCode: SourceCode
) {
  if (!slotAttr) {
    return 'default'
  }
  if (!slotAttr.directive) {
    return slotAttr.value ? slotAttr.value.value : 'default'
  }
  return slotAttr.value ? `[${sourceCode.getText(slotAttr.value)}]` : '[null]'
}

/**
 * Checks whether parent element has the same slot as the given slot.
 */
function hasSameSlotDirective(
  ownerElement: VElement,
  targetSlot: SlotContext,
  sourceCode: SourceCode,
  tokenStore: ParserServices.TokenStore
) {
  for (const group of iterateChildElementsChains(ownerElement)) {
    if (group.includes(targetSlot.element)) {
      continue
    }
    for (const childElement of group) {
      const slot = getSlotContext(childElement, sourceCode)
      if (!targetSlot.slotVForVars || !slot.slotVForVars) {
        if (
          !targetSlot.slotVForVars &&
          !slot.slotVForVars &&
          targetSlot.normalizedName === slot.normalizedName
        ) {
          return true
        }
      } else if (
        equalSlotVForVariables(
          targetSlot.slotVForVars,
          slot.slotVForVars,
          tokenStore
        )
      ) {
        return true
      }
    }
  }
  return false
}

/**
 * Determines whether the two given `v-slot` variables are considered to be equal.
 */
function equalSlotVForVariables(
  a: SlotVForVariables,
  b: SlotVForVariables,
  tokenStore: ParserServices.TokenStore
) {
  if (
    a.variables.length !== b.variables.length ||
    !equal(a.expr.right, b.expr.right)
  ) {
    return false
  }

  const checkedVarNames = new Set()
  const len = Math.min(a.expr.left.length, b.expr.left.length)
  for (let index = 0; index < len; index++) {
    const aPtn = a.expr.left[index]
    const bPtn = b.expr.left[index]

    const aVar = a.variables.find(
      (v: any) =>
        aPtn.range[0] <= v.id.range[0] && v.id.range[1] <= aPtn.range[1]
    )
    const bVar = b.variables.find(
      (v: any) =>
        bPtn.range[0] <= v.id.range[0] && v.id.range[1] <= bPtn.range[1]
    )
    if (aVar && bVar) {
      if (aVar.id.name !== bVar.id.name || !equal(aPtn, bPtn)) {
        return false
      }
      checkedVarNames.add(aVar.id.name)
    } else if (aVar || bVar) {
      return false
    }
  }
  return a.variables.every(
    (v: any) =>
      checkedVarNames.has(v.id.name) ||
      b.variables.some((bv: any) => v.id.name === bv.id.name)
  )

  /**
   * Determines whether the two given nodes are considered to be equal.
   */
  function equal(a: ASTNode, b: ASTNode) {
    return a.type === b.type ? equalTokens(a, b, tokenStore) : false
  }
}
