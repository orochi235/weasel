/**
 * Pure reorder primitives. All operate on a flat ordered id list (z-order:
 * index 0 = bottom, last = top) and return a new list. Stable: relative
 * order of moved ids is preserved.
 */

function partition(list: string[], moving: string[]): { kept: string[]; movedInOrder: string[] } {
  const movingSet = new Set(moving);
  const kept: string[] = [];
  const movedInOrder: string[] = [];
  for (const id of list) {
    if (movingSet.has(id)) movedInOrder.push(id);
    else kept.push(id);
  }
  return { kept, movedInOrder };
}

export function bringForward(list: string[], ids: string[]): string[] {
  const movingSet = new Set(ids);
  const out = list.slice();
  // Walk from top down; each moving id swaps up by one if its upper neighbor
  // is not also moving (prevents block from running into itself).
  for (let i = out.length - 2; i >= 0; i--) {
    if (movingSet.has(out[i]) && !movingSet.has(out[i + 1])) {
      const tmp = out[i];
      out[i] = out[i + 1];
      out[i + 1] = tmp;
    }
  }
  return out;
}

export function sendBackward(list: string[], ids: string[]): string[] {
  const movingSet = new Set(ids);
  const out = list.slice();
  for (let i = 1; i < out.length; i++) {
    if (movingSet.has(out[i]) && !movingSet.has(out[i - 1])) {
      const tmp = out[i];
      out[i] = out[i - 1];
      out[i - 1] = tmp;
    }
  }
  return out;
}

export function bringToFront(list: string[], ids: string[]): string[] {
  const { kept, movedInOrder } = partition(list, ids);
  return [...kept, ...movedInOrder];
}

export function sendToBack(list: string[], ids: string[]): string[] {
  const { kept, movedInOrder } = partition(list, ids);
  return [...movedInOrder, ...kept];
}

export function moveToIndex(list: string[], ids: string[], index: number): string[] {
  const { kept, movedInOrder } = partition(list, ids);
  const clamped = Math.max(0, Math.min(kept.length, index));
  return [...kept.slice(0, clamped), ...movedInOrder, ...kept.slice(clamped)];
}

/**
 * True iff `bringForward(list, ids)` would change `list` — i.e. at least one
 * id in `ids` is present in `list` AND has a non-moving (non-`ids`) neighbor
 * above it. Mirrors the swap rule in `bringForward`: a moving id only swaps
 * up when its upper neighbor isn't also moving, so a contiguous block at the
 * top is correctly reported as "can't move forward".
 *
 * Use this to drive button-disabled state in toolbars / menus so the user
 * never fires a no-op reorder onto the undo stack.
 */
export function canBringForward(list: string[], ids: string[]): boolean {
  const movingSet = new Set(ids);
  for (let i = 0; i < list.length - 1; i++) {
    if (movingSet.has(list[i]) && !movingSet.has(list[i + 1])) return true;
  }
  return false;
}

/** Symmetric to `canBringForward` — see that docstring. */
export function canSendBackward(list: string[], ids: string[]): boolean {
  const movingSet = new Set(ids);
  for (let i = 1; i < list.length; i++) {
    if (movingSet.has(list[i]) && !movingSet.has(list[i - 1])) return true;
  }
  return false;
}
