/**
 * `nodeAsShown` — a node with the data its override shows it with.
 *
 * The one read of `PoseOverride.data`. Painting, picking, drawn bounds and the
 * effective reading of a derivation go through it; the document, history and
 * `scene.get` never do.
 */
import type { NodeId } from './types';

/** What `nodeAsShown` reads of the overrides: a `Scene`'s satisfy it. */
export interface ShownDataSource {
  read(id: NodeId): { data?(stored: never): unknown } | undefined;
}

interface Held {
  stored: unknown;
  data: (stored: never) => unknown;
  shown: object;
}

/** Per stored node, the last shown copy and what it was made from: keeping it
 *  is what lets a memo keyed on the node, or on its data, hit frame to frame
 *  while neither changes. */
const shownCopies = new WeakMap<object, Held>();

/** The copies `nodeAsShown` made, which it hands back as they are: a reader
 *  given a shown node may ask again, and the override must apply once. */
const madeShown = new WeakSet<object>();

/**
 * `node` with its `data` replaced by what its override's `data` answers from
 * it, or `node` itself when nothing overrides its data or it is already shown.
 * The same object while the stored node, its data and the override's function
 * are unchanged.
 */
export function nodeAsShown<TNode extends { id: NodeId; data?: unknown }>(
  overrides: ShownDataSource,
  node: TNode,
): TNode {
  if (madeShown.has(node)) return node;
  const data = overrides.read(node.id)?.data;
  if (data === undefined) return node;
  const held = shownCopies.get(node);
  if (held !== undefined && held.data === data && held.stored === node.data) return held.shown as TNode;
  const shown = { ...node, data: data(node.data as never) };
  shownCopies.set(node, { stored: node.data, data, shown });
  madeShown.add(shown);
  return shown;
}
