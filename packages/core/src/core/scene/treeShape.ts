import type { NodeId } from '@weasel-js/routing';

/** True for a node with no children: absent and empty are the same thing. */
export function isLeaf(node: { children?: readonly NodeId[] }): boolean {
  return node.children === undefined || node.children.length === 0;
}

export function hasChildren<T extends { children?: readonly NodeId[] }>(
  node: T,
): node is T & { children: NodeId[] } {
  return node.children !== undefined && node.children.length > 0;
}
