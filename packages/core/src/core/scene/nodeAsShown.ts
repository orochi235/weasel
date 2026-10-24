/**
 * `nodeAsShown` — a node with the data its override shows it with.
 *
 * The one read of `PoseOverride.data`. Painting, picking, drawn bounds and the
 * effective reading of a derivation go through it; the document reading
 * (`documentOf`), history and `scene.get` never do.
 */
import type { NodeId } from './types';

/** What `nodeAsShown` reads of the overrides: a `Scene`'s satisfy it. */
export interface ShownDataSource {
  read(id: NodeId): { data?(stored: never): unknown } | undefined;
}

/** Marks a node whose data is already shown. An own enumerable key, so a spread
 *  of the node (`{ ...node, pose }`) carries it, and applying an override to a
 *  copy of a shown node is a no-op however the copy was made. */
const SHOWN: unique symbol = Symbol('weasel.shownData');

interface Held {
  stored: unknown;
  data: (stored: never) => unknown;
  shown: object;
}

/** Per stored node, the last shown copy and what it was made from: keeping it
 *  is what lets a memo keyed on the node, or on its data, hit frame to frame
 *  while neither changes. */
const shownCopies = new WeakMap<object, Held>();

/**
 * `node` with its `data` replaced by what its override's `data` answers from
 * it, or `node` itself when nothing overrides its data or its data is already
 * shown. The same object while the stored node, its data and the override's
 * function are unchanged.
 */
export function nodeAsShown<TNode extends { id: NodeId; data?: unknown }>(
  overrides: ShownDataSource,
  node: TNode,
): TNode {
  if (SHOWN in node) return node;
  const data = overrides.read(node.id)?.data;
  if (data === undefined) return node;
  const held = shownCopies.get(node);
  if (held !== undefined && held.data === data && held.stored === node.data) return held.shown as TNode;
  const shown = withShownData(node, data(node.data as never));
  shownCopies.set(node, { stored: node.data, data, shown });
  return shown;
}

/** `node` showing `data`, marked so that no override applies to it again: for
 *  a reader that already holds the data to show, such as a gesture's ghost. */
export function withShownData<TNode extends object>(node: TNode, data: unknown): TNode {
  return { ...node, data, [SHOWN]: true };
}

/** The last copy `nodeAsShown` made of `node`, if any — what a reader handed
 *  the shown node memoized against, for invalidating with the stored one. */
export function shownCopyOf(node: object): object | undefined {
  return shownCopies.get(node)?.shown;
}

/** `source`'s `get`, answering each node as it shows. For a reader that walks
 *  up from a node, such as inherited paint looking through its containers. */
export function shownLookup<TNode extends { id: NodeId; data?: unknown }>(
  source: { overrides: ShownDataSource; get(id: NodeId): TNode | undefined },
): { get(id: NodeId): TNode | undefined } {
  return {
    get: (id) => {
      const node = source.get(id);
      return node === undefined ? undefined : nodeAsShown(source.overrides, node);
    },
  };
}

type CountedSource = ShownDataSource & { ids(): readonly NodeId[]; getGeneration(): number };

/** Per overrides table, whether any entry shows data, as of a generation. */
const anyData = new WeakMap<object, { at: number; any: boolean }>();

/** `nodes`, each as it shows; the same array when nothing overrides any node's
 *  data. Answers that from the table's generation, so a pick with nothing
 *  overridden allocates nothing. */
export function nodesAsShown<TNode extends { id: NodeId; data?: unknown }>(
  overrides: CountedSource,
  nodes: readonly TNode[],
): readonly TNode[] {
  const at = overrides.getGeneration();
  let held = anyData.get(overrides);
  if (held === undefined || held.at !== at) {
    held = { at, any: overrides.ids().some((id) => overrides.read(id)?.data !== undefined) };
    anyData.set(overrides, held);
  }
  return held.any ? nodes.map((node) => nodeAsShown(overrides, node)) : nodes;
}
