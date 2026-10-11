import type { Op } from './op';

/** What a {@link swapOp} carries as its `args`: the value it leaves and the one it makes. */
export interface SwapArgs<V> {
  before: V;
  after: V;
}

/** What {@link swapOp} is built from. */
export interface SwapOpOptions<V> extends SwapArgs<V> {
  /** The op's `name`, which a history's `rebuildOp` matches to rebuild it from a snapshot. */
  name: string;
  label: string;
  /** Puts a value in force. Called with `after` to apply and `before` to undo. */
  emit(value: V): void;
  coalesceKey?: string;
}

/**
 * An edit as the swap of one whole value for another. For a value held immutably the two snapshots are
 * references, and the op carries both as `args`, so a serialized history can rebuild the step.
 */
export function swapOp<V>({ name, label, before, after, emit, coalesceKey }: SwapOpOptions<V>): Op {
  const forward: Op = {
    label,
    name,
    args: { before, after } satisfies SwapArgs<V>,
    ...(coalesceKey !== undefined ? { coalesceKey } : {}),
    apply: () => emit(after),
    invert: () => ({ label, apply: () => emit(before), invert: () => forward }),
  };
  return forward;
}
