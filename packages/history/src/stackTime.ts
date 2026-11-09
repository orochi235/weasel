import type { Entry } from './serialized';

// The redo stack is newest-on-top, so time order runs from its end.

/** `History.timestampAt` over the two stacks. */
export function timestampAt(undoStack: readonly Entry[], redoStack: readonly Entry[], i: number): number | undefined {
  if (!Number.isInteger(i) || i < 0) return undefined;
  if (i < undoStack.length) return undoStack[i]!.timestamp;
  return redoStack[redoStack.length - 1 - (i - undoStack.length)]?.timestamp;
}

/** `History.depthAt` over the two stacks. */
export function depthAt(undoStack: readonly Entry[], redoStack: readonly Entry[], t: number): number {
  let n = undoStack.length;
  while (n > 0 && undoStack[n - 1]!.timestamp > t) n--;
  if (n < undoStack.length) return n;
  for (let r = redoStack.length - 1; r >= 0 && redoStack[r]!.timestamp <= t; r--) n++;
  return n;
}
