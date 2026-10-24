/**
 * The scene walks' half of `PoseOverride.data`: handing painters, cull bounds
 * and pickers each node as the scene shows it, through `nodeAsShown`.
 */
import { nodeAsShown, type ShownDataSource } from 'core/scene/nodeAsShown';
import type { NodeId } from 'core/scene/types';

export { nodeAsShown };

type ShownNode = { id: NodeId; data?: unknown };

/** `scene`'s `get`, answering each node as it shows. For a reader that walks
 *  up from a node, such as inherited paint looking through its containers. */
export function shownLookup<TNode extends ShownNode>(
  scene: { overrides: ShownDataSource; get(id: NodeId): TNode | undefined },
): { get(id: NodeId): TNode | undefined } {
  return {
    get: (id) => {
      const node = scene.get(id);
      return node === undefined ? undefined : nodeAsShown(scene.overrides, node);
    },
  };
}

/** `fn`, a painter or a cull's bounds, handed each node as it shows. */
export function withShownNode<TNode extends ShownNode, A, B, C, TOut>(
  overrides: ShownDataSource,
  fn: (node: TNode, a: A, b: B, c: C) => TOut,
): (node: TNode, a: A, b: B, c: C) => TOut {
  return (node, a, b, c) => fn(nodeAsShown(overrides, node), a, b, c);
}

/** `nodes`, each as it shows; the same array when nothing overrides any of their data. */
export function nodesAsShown<TNode extends ShownNode>(
  overrides: ShownDataSource & { ids(): readonly NodeId[] },
  nodes: readonly TNode[],
): readonly TNode[] {
  if (!overrides.ids().some((id) => overrides.read(id)?.data !== undefined)) return nodes;
  return nodes.map((node) => nodeAsShown(overrides, node));
}
