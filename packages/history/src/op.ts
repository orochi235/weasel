/**
 * An invertible mutation. Applied via an adapter; produces an inverse op
 * that, when applied to the same adapter, undoes the original.
 *
 * Adapters are intentionally typed loosely here so different op types can
 * require different adapter capabilities. Each op is responsible for
 * narrowing the adapter via the methods it calls.
 *
 * Lives here rather than in `@weasel-js/core` because an invertible,
 * replayable mutation is a history concept: this package is what pushes ops
 * onto a stack, inverts them, coalesces them, and rebuilds them from a
 * serialized snapshot. Nothing about the shape is core-specific — it names no
 * scene, node, or pose type. Core re-exports it from `core/ops/types` so its
 * own call sites read unchanged.
 */
export interface Op {
  /** Apply the mutation. Return `false` (or `'noop'`) to signal that
   *  nothing changed — the history layer then skips pushing an undo
   *  entry for the batch when *every* op reports no-op. Returning
   *  `undefined`/`void` means "mutated" (the common case; existing ops
   *  don't need to change). */
  apply(adapter: unknown): void | boolean | 'noop';
  invert(): Op;
  label?: string;
  coalesceKey?: string;
  /** Stable factory name for op-registry lookup. Kit-emitted ops always
   *  set this; consumer ops without a name can't round-trip through
   *  `History.serialize()` and are dropped from persisted snapshots. */
  name?: string;
  /** Serializable args (JSON / structured-clone-safe) that, paired with
   *  `name`, reconstruct the op via the registry's `rebuildOp`. */
  args?: unknown;
}
