/** Sibling-order read seam. Optional everywhere: a flat adapter has none. */
export interface OrderedReader {
  getChildren?(parentId: string | null): string[];
}

/**
 * A node's position among its siblings, recorded so an op can put it back.
 *
 * Recorded as an anchor (`before`) plus an ordinal (`index`). The anchor is
 * the source of truth: `History` replays a batch's inverses in reverse order,
 * so an ordinal captured before the mutation is replayed against a list that
 * has not been refilled yet and clamps to the end, while "put this back before
 * `e`" stays true however much else has already moved. The ordinal is the
 * fallback for the cases the anchor cannot cover — an adapter with no
 * `getChildren` seam, or an anchor that is itself gone by replay time.
 */
export interface SiblingSlot {
  /** Ordinal among the siblings. `-1` means "nowhere in particular". */
  index: number;
  /** Id of the sibling that followed at capture time; `null` when the node
   *  was last. Absent when nothing observed it — `null` survives JSON and
   *  `undefined` does not, so the two stay distinguishable across a
   *  serialize/restore round trip. */
  before?: string | null;
}

/** Observe `id`'s slot among `parentId`'s children. `null` when the adapter
 *  has no ordering seam or `id` isn't there — callers keep whatever weaker
 *  slot they already had rather than overwriting it with a guess. */
export function captureSlot(
  a: OrderedReader,
  parentId: string | null,
  id: string,
): SiblingSlot | null {
  const siblings = a.getChildren?.(parentId);
  if (!siblings) return null;
  const i = siblings.indexOf(id);
  if (i < 0) return null;
  return { index: i, before: i + 1 < siblings.length ? siblings[i + 1]! : null };
}

/**
 * Index `slot` denotes in `siblings`, which must NOT contain the node being
 * placed. `undefined` means "no position" — the caller appends, or lets the
 * adapter's default placement stand.
 */
export function resolveSlot(
  siblings: readonly string[] | undefined,
  slot: SiblingSlot,
): number | undefined {
  if (slot.before === null) return undefined;
  if (slot.before !== undefined && siblings) {
    const at = siblings.indexOf(slot.before);
    if (at >= 0) return at;
  }
  return slot.index >= 0 ? slot.index : undefined;
}

/** The reads that locate a live node: its parent, and that parent's children. */
export interface ParentedReader {
  getParent?(id: string): string | null;
  getChildren?(parentId: string | null): readonly string[];
}

/** A node's parent (`null` at the top level) and its ordinal among that
 *  parent's children — the position a replacement takes to keep its z-order. */
export interface ChildPosition {
  parentId: string | null;
  index: number;
}

/** Where `id` sits under its parent. An adapter with no `getParent` is flat,
 *  as the reorder ops read it. `null` when there is no `getChildren` or it
 *  does not list `id`. */
export function locateChild(a: ParentedReader, id: string): ChildPosition | null {
  if (!a.getChildren) return null;
  const parentId = a.getParent ? a.getParent(id) : null;
  const index = a.getChildren(parentId).indexOf(id);
  return index < 0 ? null : { parentId, index };
}

/** Normalize the `index` sugar every op factory accepts into a slot. */
export function slotFromIndex(index: number | undefined): SiblingSlot {
  return { index: index ?? -1 };
}

/** The parent a node claims. Nodes in a flat adapter have none. */
export function parentOf(node: object): string | null {
  return ((node as { parent?: unknown }).parent ?? null) as string | null;
}
