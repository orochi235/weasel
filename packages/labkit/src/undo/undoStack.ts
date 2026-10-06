/**
 * @deprecated The whole module. A trial's undo runs on weasel-history
 * (`TrialRecord.history`); for an undo of your own, `createHistory` from
 * `@weasel-js/core`. Kept until sherpa's studio, its last user, moves off it.
 */

/** Undo history as two stacks of state snapshots: what has been done, and
 *  what has been undone. The present state is held elsewhere, not here.
 *  @deprecated See the module comment. */
export interface UndoStack {
  past: unknown[];
  future: unknown[];
}

/** A fresh, empty history.
 *  @deprecated See the module comment. */
export function emptyStack(): UndoStack {
  return { past: [], future: [] };
}

/** Record a new snapshot, discarding the redo branch and the oldest entry
 *  once `maxDepth` is reached.
 *  @deprecated See the module comment. */
export function pushSnapshot(stack: UndoStack, snapshot: unknown, maxDepth: number): UndoStack {
  const past = stack.past.length >= maxDepth ? stack.past.slice(1) : stack.past.slice();
  past.push(snapshot);
  return { past, future: [] };
}

/** Step back one snapshot, returning the new history and the state to restore.
 *  `null` when there is nothing to undo. The caller supplies `current` so it
 *  can be redone.
 *  @deprecated See the module comment. */
export function undo(
  stack: UndoStack,
  current: unknown,
): { stack: UndoStack; snapshot: unknown } | null {
  if (stack.past.length === 0) return null;
  const past = stack.past.slice();
  const snapshot = past.pop();
  return { stack: { past, future: [...stack.future, current] }, snapshot };
}

/** Step forward one snapshot, returning the new history and the state to
 *  restore. `null` when there is nothing to redo.
 *  @deprecated See the module comment. */
export function redo(
  stack: UndoStack,
  current: unknown,
): { stack: UndoStack; snapshot: unknown } | null {
  if (stack.future.length === 0) return null;
  const future = stack.future.slice();
  const snapshot = future.pop();
  return { stack: { past: [...stack.past, current], future }, snapshot };
}

/** Discard the whole history.
 *  @deprecated See the module comment. */
export function clearUndo(_stack: UndoStack): UndoStack {
  return emptyStack();
}
