export interface UndoStack {
  past: unknown[];
  future: unknown[];
}

export function emptyStack(): UndoStack {
  return { past: [], future: [] };
}

export function pushSnapshot(stack: UndoStack, snapshot: unknown, maxDepth: number): UndoStack {
  const past = stack.past.length >= maxDepth ? stack.past.slice(1) : stack.past.slice();
  past.push(snapshot);
  return { past, future: [] };
}

export function undo(
  stack: UndoStack,
  current: unknown,
): { stack: UndoStack; snapshot: unknown } | null {
  if (stack.past.length === 0) return null;
  const past = stack.past.slice();
  const snapshot = past.pop();
  return { stack: { past, future: [...stack.future, current] }, snapshot };
}

export function redo(
  stack: UndoStack,
  current: unknown,
): { stack: UndoStack; snapshot: unknown } | null {
  if (stack.future.length === 0) return null;
  const future = stack.future.slice();
  const snapshot = future.pop();
  return { stack: { past: [...stack.past, current], future }, snapshot };
}

export function clearUndo(_stack: UndoStack): UndoStack {
  return emptyStack();
}
