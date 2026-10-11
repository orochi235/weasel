import type { SerializedHistory, SerializedHistoryEntry, SerializedOp } from '@weasel-js/core';

/** `stacks` with the two values every step swaps put through `fn`. */
export function mapSwaps<A, B>(stacks: SerializedHistory, fn: (value: A) => B): SerializedHistory {
  const ops = (list: readonly SerializedOp[]): SerializedOp[] => list.map((op) => {
    const { before, after } = op.args as { before: A; after: A };
    return { ...op, args: { before: fn(before), after: fn(after) } };
  });
  const entry = (e: SerializedHistoryEntry): SerializedHistoryEntry => ({ ...e, forwardOps: ops(e.forwardOps), baseOps: ops(e.baseOps) });
  return { ...stacks, undoStack: stacks.undoStack.map(entry), redoStack: stacks.redoStack.map(entry) };
}
