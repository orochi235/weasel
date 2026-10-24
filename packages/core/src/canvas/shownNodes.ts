/**
 * The scene walks' half of `PoseOverride.data`: handing painters and cull
 * bounds each node as the scene shows it, through `nodeAsShown`.
 */
import { nodeAsShown, type ShownDataSource } from 'core/scene/nodeAsShown';
import type { NodeId } from 'core/scene/types';

/** `fn`, a painter or a cull's bounds, handed each node as it shows. */
export function withShownNode<TNode extends { id: NodeId; data?: unknown }, A, B, C, TOut>(
  overrides: ShownDataSource,
  fn: (node: TNode, a: A, b: B, c: C) => TOut,
): (node: TNode, a: A, b: B, c: C) => TOut {
  return (node, a, b, c) => fn(nodeAsShown(overrides, node), a, b, c);
}
