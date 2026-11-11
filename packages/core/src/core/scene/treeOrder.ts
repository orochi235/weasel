import type { Node, NodeId } from './types';
import { hasChildren } from './treeShape';

/** Every node reachable from `roots`, in tree preorder: a parent before its
 *  children, siblings in sibling order, whatever layer each sits on. */
export function treePreorder<TData, TLayer extends string, TPose>(
  roots: readonly NodeId[],
  nodes: ReadonlyMap<NodeId, Node<TData, TLayer, TPose>>,
): Node<TData, TLayer, TPose>[] {
  const out: Node<TData, TLayer, TPose>[] = [];
  const stack: NodeId[] = [...roots].reverse();
  while (stack.length > 0) {
    const node = nodes.get(stack.pop()!);
    if (!node) continue;
    out.push(node);
    if (hasChildren(node)) {
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]);
    }
  }
  return out;
}

/** Where `index` places a node among `length` siblings: truncated, held to the ends, `NaN` at the start.
 *  Payloads record it so, since JSON writes `Infinity` as `null`, which a reloaded history places at the start. */
export function slotIndex(index: number, length: number): number {
  return index > 0 ? Math.min(Math.trunc(index), length) : 0;
}
