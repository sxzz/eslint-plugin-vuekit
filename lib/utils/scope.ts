import type { ASTNode, ESNode, RuleContext } from '../types/index.ts'
/**
 * Gets the scope for the current node
 */
export function getScope(context: RuleContext, currentNode: ESNode) {
  // On Program node, get the outermost scope to avoid return Node.js special function scope or ES modules scope.
  const isInner = currentNode.type !== 'Program'
  const scopeManager = context.sourceCode.scopeManager

  let node: ASTNode | null = currentNode
  for (; node; node = node.parent) {
    const scope = scopeManager.acquire(node as ESNode, isInner)

    if (scope) {
      return scope.type === 'function-expression-name'
        ? scope.childScopes[0]
        : scope
    }
  }

  return scopeManager.scopes[0]
}
