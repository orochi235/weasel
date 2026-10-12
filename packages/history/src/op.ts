/**
 * An invertible mutation. Applied via an adapter; produces an inverse op
 * that, when applied to the same adapter, undoes the original.
 *
 * Adapters are intentionally typed loosely here so different op types can
 * require different adapter capabilities. Each op is responsible for
 * narrowing the adapter via the methods it calls.
 */
export interface Op {
  /** Apply the mutation. Return `false` (or `'noop'`) to signal that
   *  nothing changed — the history layer then skips pushing an undo
   *  entry for the batch when *every* op reports no-op. Returning
   *  `undefined`/`void` means "mutated". */
  apply(adapter: unknown): void | boolean | 'noop';
  invert(): Op;
  /** Leave this op out of the recorded entry when its first apply reports a
   *  no-op. For an op an owner appends to every edit in case it is needed:
   *  left in, it would stop the edit coalescing with one that needed none. */
  elideNoop?: boolean;
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
