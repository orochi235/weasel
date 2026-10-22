/**
 * `nodeMemo` — memoize anything derived from a node, keyed on the node's
 * identity plus the `pose` / `data` references the scene swaps on every edit.
 *
 * The scene mutates node objects in place but *replaces* `pose` and `data`
 * with new references, so those two references are an exact freshness signal.
 * The assumption it rests on: nobody mutates `node.data` (or `node.pose`) in
 * place without replacing the reference. A consumer who violates it sees a
 * stale derivation until the next real edit.
 *
 * **What the key does not cover** is ambient state that `derive` reads — a
 * registry, a font set, a decode cache. Whoever owns the ambient state calls
 * {@link bumpNodeMemoGeneration}. Derivations that read ambient state with
 * *no* such signal (an async image decode landing, say) must not be memoized
 * here at all.
 */

/** One memoized derivation: the references it was derived against, plus the
 *  value. Presence in the slot map is what "computed" means — a `null` or
 *  `undefined` value is a real answer and stays cached. */
interface MemoSlot {
  /** Reference-compared against the caller's `pose` argument. */
  pose: unknown;
  /** Reference-compared against `node.data` at call time. */
  data: unknown;
  /** Reference-compared against the caller's `also` argument. */
  also: unknown;
  value: unknown;
}

interface NodeMemoRecord {
  /** `generation` at the time the slots were filled. */
  generation: number;
  slots: Map<string, MemoSlot>;
  /** How many times {@link dropPoseKeyedMemoSlots} has run for this node,
   *  which is how a drop reaches the scopes it cannot enumerate. */
  drops: number;
}

/** A scoped entry also carries what a named slot's record holds for it. */
interface ScopedSlot extends MemoSlot {
  generation: number;
  drops: number;
}

declare const scopeBrand: unique symbol;

/**
 * A private place to memoize one derivation, in place of a slot name.
 *
 * A named slot lives on the node, so it lasts as long as the node does. That
 * is wrong for a derivation that belongs to some shorter-lived reader — one
 * `toPose` function among many over the life of a scene. A scope is held by
 * that reader, and its entries go when the reader does.
 */
export type NodeMemoScope = { readonly [scopeBrand]: true };

export function createNodeMemoScope(): NodeMemoScope {
  return new WeakMap<object, ScopedSlot>() as unknown as NodeMemoScope;
}

const MEMO = new WeakMap<object, NodeMemoRecord>();

/** Bumped whenever ambient state a derivation reads has changed. Entries
 *  stamped with an older value are dropped rather than served stale. */
let generation = 0;

/** A node, as far as the memo is concerned: an object identity that may carry
 *  a `data` reference. */
type MemoizableNode = { data?: unknown };

/**
 * Return the value `derive` produces for `node`, recomputing only when the
 * node's `data` reference, the given `pose` reference, the `also` reference,
 * or the global generation has changed since the last call for this `slot`.
 *
 * `slot` names the derivation, so a node's several derived values do not
 * overwrite each other.
 *
 * `pose` is a **parameter rather than a read off the node**, because callers
 * legitimately derive against a pose that isn't `node.pose`: a preview or
 * ghost pose mid-drag. Pass `undefined` for derivations that don't depend on
 * the pose at all, leaving `data` as the only key.
 *
 * `also` is for an input that lives outside the node, such as the paint a
 * node inherits from its container. It must be a reference its owner keeps
 * while the input is unchanged.
 */
export function nodeMemo<T>(
  node: MemoizableNode,
  slot: string | NodeMemoScope,
  pose: unknown,
  derive: () => T,
  also?: unknown,
): T {
  if (typeof slot !== 'string') return scopedNodeMemo(node, slot, pose, derive, also);
  let record = MEMO.get(node);
  if (record === undefined) {
    record = { generation, slots: new Map(), drops: 0 };
    MEMO.set(node, record);
  } else if (record.generation !== generation) {
    record.generation = generation;
    record.slots.clear();
  }

  const data = node.data;
  const hit = record.slots.get(slot);
  if (hit !== undefined && hit.pose === pose && hit.data === data && hit.also === also) {
    return hit.value as T;
  }

  const value = derive();
  // Reuse the slot object when there is one: this runs per node per frame, and
  // the entry churn is the only allocation the memo would otherwise add.
  if (hit !== undefined) {
    hit.pose = pose;
    hit.data = data;
    hit.also = also;
    hit.value = value;
  } else {
    record.slots.set(slot, { pose, data, also, value });
  }
  return value;
}

function scopedNodeMemo<T>(
  node: MemoizableNode,
  scope: NodeMemoScope,
  pose: unknown,
  derive: () => T,
  also: unknown,
): T {
  const entries = scope as unknown as WeakMap<object, ScopedSlot>;
  const data = node.data;
  const drops = MEMO.get(node)?.drops ?? 0;
  const hit = entries.get(node);
  if (
    hit !== undefined && hit.generation === generation && hit.pose === pose && hit.data === data
    && hit.also === also    && (pose === undefined || hit.drops === drops)
  ) {
    return hit.value as T;
  }
  const value = derive();
  // Read again: a derivation that hit a cycle drops this node's slots itself.
  const dropsNow = MEMO.get(node)?.drops ?? 0;
  if (hit !== undefined) {
    hit.pose = pose;
    hit.data = data;
    hit.also = also;
    hit.value = value;
    hit.generation = generation;
    hit.drops = dropsNow;
  } else {
    entries.set(node, { pose, data, also, value, generation, drops: dropsNow });
  }
  return value;
}

/** How many named slots `node` holds. For tests of what is kept on a node. */
export function nodeMemoSlotCount(node: MemoizableNode): number {
  const record = MEMO.get(node);
  return record === undefined || record.generation !== generation ? 0 : record.slots.size;
}

/**
 * Drop every memoized slot on every node. For owners of ambient state that
 * changes what a `derive` would return. Cheap — it bumps a counter.
 */
export function bumpNodeMemoGeneration(): void {
  generation++;
}

/** The generation {@link bumpNodeMemoGeneration} last moved to: a freshness
 *  key for a cache outside this memo that reads the same ambient state. */
export function nodeMemoGeneration(): number {
  return generation;
}

/**
 * Drop the slots of `node` that were keyed on a pose, keeping the ones that
 * weren't.
 *
 * For per-frame pose overrides, which mutate one buffer in place rather than
 * replacing the reference, which the `(pose, data)` key cannot see.
 * {@link bumpNodeMemoGeneration} is the wrong tool there — it would drop every
 * static node's slots too, every frame.
 */
export function dropPoseKeyedMemoSlots(node: MemoizableNode): void {
  const record = MEMO.get(node);
  if (record === undefined) {
    MEMO.set(node, { generation, slots: new Map(), drops: 1 });
    return;
  }
  record.drops++;
  for (const [slot, entry] of record.slots) {
    if (entry.pose !== undefined) record.slots.delete(slot);
  }
}
