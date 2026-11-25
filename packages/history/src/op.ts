/**
 * An invertible mutation. Applied via an adapter; produces an inverse op
 * that, when applied to the same adapter, undoes the original.
 *
 * Adapters are intentionally typed loosely here so different op types can
 * require different adapter capabilities. Each op is responsible for
 * narrowing the adapter via the methods it calls.
 *
 * **Rollback contract.** An `apply` either completes or throws having
 * changed nothing. When one throws, the history takes back the ops before it
 * in the step (inverting them, newest first), leaves the entry on the stack
 * it was on, and rethrows; it cannot take back a partial write by the op
 * that threw. A scene also reverts its own node writes, the throwing op's
 * included, so the contract binds an op writing anywhere else.
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
  /** What the entry records in this op's place once it has applied: the ops
   *  that replay what it did. For an op whose effect is decided as it runs,
   *  so that undo and redo return to what it wrote rather than working it out
   *  again. Read once, after the batch's first apply; never on a replay. */
  caused?(): Op[];
  label?: string;
  /** Lets a batch merge into the entry above it inside `coalesceWindowMs`. The merged entry keeps
   *  only the first batch to undo and the latest to redo, so a keyed op must write an absolute
   *  value (move to x, not by dx); a relative edit records each batch under `recordEntry`'s key. */
  coalesceKey?: string;
  /** Stable factory name for op-registry lookup. Kit-emitted ops always
   *  set this; consumer ops without a name can't round-trip through
   *  `History.serialize()` and are dropped from persisted snapshots. */
  name?: string;
  /** Serializable args (JSON / structured-clone-safe) that, paired with
   *  `name`, reconstruct the op through the history's `rebuildOp`. */
  args?: unknown;
}
