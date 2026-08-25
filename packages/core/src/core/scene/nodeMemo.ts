/**
 * `nodeMemo` — memoize anything derived from a node, keyed on the node's
 * identity plus the `pose` / `data` references the scene swaps on every edit.
 *
 * **Why this key works.** The scene mutates node objects in place but
 * *replaces* `pose` and `data` with new references — see the `kit:setPose` /
 * `kit:setData` ops in `core/scene/scene.ts`, which do `node.pose = p.to` /
 * `node.data = p.to`. So the node object is a stable identity, and those two
 * references are an exact freshness signal for anything derived per node: no
 * deep compare, no dirty flag, no subscription. The whole memo is three
 * reference comparisons.
 *
 * The assumption it rests on is the other side of that contract: nobody
 * mutates `node.data` (or `node.pose`) in place without replacing the
 * reference. A consumer who violates it sees a stale derivation until the next
 * real edit.
 *
 * **What the key does not cover** is ambient state that `derive` reads — a
 * registry, a font set, a decode cache. Those change what `derive` would
 * return with no change to the node at all, which is the one failure a
 * `(pose, data)` key cannot see. {@link bumpNodeMemoGeneration} is the escape
 * hatch: whoever owns the ambient state bumps, and every slot on every node is
 * dropped. Derivations that read ambient state with *no* such signal (an async
 * image decode landing, say) must not be memoized here at all.
 *
 * Consumers: `canvas/NodeShape.ts` memoizes the painter match and the
 * silhouette path this way.
 */

/** One memoized derivation: the references it was derived against, plus the
 *  value. Presence in the slot map is what "computed" means — a `null` or
 *  `undefined` value is a real answer and stays cached. */
interface MemoSlot {
  /** Reference-compared against the caller's `pose` argument. */
  pose: unknown;
  /** Reference-compared against `node.data` at call time. */
  data: unknown;
  value: unknown;
}

interface NodeMemoRecord {
  /** `generation` at the time the slots were filled. */
  generation: number;
  slots: Map<string, MemoSlot>;
}

const MEMO = new WeakMap<object, NodeMemoRecord>();

/** Bumped whenever ambient state a derivation reads has changed. Entries
 *  stamped with an older value are dropped rather than served stale. */
let generation = 0;

/** A node, as far as the memo is concerned: an object identity that may carry
 *  a `data` reference. Deliberately not `Node<…>` — the memo doesn't read
 *  anything else, and typing it loosely keeps `core/scene` from depending on
 *  the full node shape for a three-comparison cache. */
type MemoizableNode = { data?: unknown };

/**
 * Return the value `derive` produces for `node`, recomputing only when the
 * node's `data` reference, the given `pose` reference, or the global
 * generation has changed since the last call for this `slot`.
 *
 * `slot` names the derivation. A node has more than one derived value — the
 * painter match, the silhouette, draw commands, text layout — and they
 * invalidate on the same signals but must not overwrite each other.
 *
 * `pose` is a **parameter rather than a read off the node**, because callers
 * legitimately derive against a pose that isn't `node.pose`: a preview or
 * ghost pose mid-drag. Those miss and recompute, as they should, and must not
 * poison the entry for the node's real pose. Pass `undefined` for derivations
 * that don't depend on the pose at all (the painter match is one) — it
 * compares equal to itself, leaving `data` as the only key.
 *
 * `data` is read off the node rather than passed: no caller has had a reason
 * to derive against data the node doesn't hold.
 */
export function nodeMemo<T>(
  node: MemoizableNode,
  slot: string,
  pose: unknown,
  derive: () => T,
): T {
  let record = MEMO.get(node);
  if (record === undefined) {
    record = { generation, slots: new Map() };
    MEMO.set(node, record);
  } else if (record.generation !== generation) {
    record.generation = generation;
    record.slots.clear();
  }

  const data = node.data;
  const hit = record.slots.get(slot);
  if (hit !== undefined && hit.pose === pose && hit.data === data) {
    return hit.value as T;
  }

  const value = derive();
  // Reuse the slot object when there is one: this runs per node per frame, and
  // the entry churn is the only allocation the memo would otherwise add.
  if (hit !== undefined) {
    hit.pose = pose;
    hit.data = data;
    hit.value = value;
  } else {
    record.slots.set(slot, { pose, data, value });
  }
  return value;
}

/**
 * Drop every memoized slot on every node.
 *
 * For owners of ambient state that changes what a `derive` would return: the
 * shape-painter registry calls this when a painter is registered or disposed,
 * since a cache keyed only on `(pose, data)` would keep answering with the
 * painter that matched before.
 *
 * Cheap — it bumps a counter; records are re-stamped lazily on next access,
 * and unreachable nodes stay collectable via the `WeakMap`.
 */
export function bumpNodeMemoGeneration(): void {
  generation++;
}

/**
 * Drop the slots of `node` that were keyed on a pose, keeping the ones that
 * weren't (the painter match passes `undefined`, and re-matching it is a
 * registry scan).
 *
 * For per-frame pose overrides, which mutate one buffer in place rather than
 * replacing the reference: the `(pose, data)` key cannot see that, so the
 * override's `commit()` calls this for each node it holds.
 * {@link bumpNodeMemoGeneration} is the wrong tool there — it would drop every
 * static node's slots too, every frame.
 */
export function dropPoseKeyedMemoSlots(node: MemoizableNode): void {
  const record = MEMO.get(node);
  if (record === undefined) return;
  for (const [slot, entry] of record.slots) {
    if (entry.pose !== undefined) record.slots.delete(slot);
  }
}
