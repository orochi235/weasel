import type { Op } from './types';
import { registerOpFactory } from './registry';

interface ReparentAdapter {
  setParent(id: string, parentId: string | null): void;
  /** Sibling-order seam, shared with the reorder ops. Optional: an adapter
   *  without it silently ignores `fromIndex` / `toIndex` and appends. */
  getChildren?(parentId: string | null): string[];
  setChildOrder?(parentId: string | null, ids: string[]): void;
}

/** @internal */
interface ReparentArgs {
  id: string;
  fromParentId: string | null;
  toParentId: string | null;
  /** Slot among the old parent's children. `invert()` forwards it as the
   *  destination slot; without it undo re-parents with no position and the
   *  node lands last, quietly changing paint order. */
  fromIndex?: number;
  /** Slot among the new parent's children. Omit to append. */
  toIndex?: number;
  label?: string;
  coalesceKey?: string;
}

/** Move `id` to `index` among `parentId`'s children. No-op when the adapter
 *  has no ordering seam, when `id` isn't there, or when it's already in
 *  place. */
function placeAt(
  a: ReparentAdapter,
  parentId: string | null,
  id: string,
  index: number,
): void {
  if (!a.getChildren || !a.setChildOrder) return;
  const current = a.getChildren(parentId);
  const from = current.indexOf(id);
  if (from < 0) return;
  const to = Math.max(0, Math.min(index, current.length - 1));
  if (from === to) return;
  const next = current.slice();
  next.splice(from, 1);
  next.splice(to, 0, id);
  a.setChildOrder(parentId, next);
}

/**
 * Op: change `id`'s parent and sibling slot, inverting back to the prior
 * parent and slot.
 *
 * `coalesceKey` defaults to `reparent:${id}` so successive reparents of the
 * same id batch-merge cleanly.
 */
export function createReparentOp(args: ReparentArgs): Op {
  const {
    id, fromParentId, toParentId, fromIndex, toIndex,
    label = 'Reparent', coalesceKey = `reparent:${id}`,
  } = args;
  return {
    name: 'reparent',
    args: { id, fromParentId, toParentId, fromIndex, toIndex, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      const a = adapter as ReparentAdapter;
      a.setParent(id, toParentId);
      if (toIndex !== undefined) placeAt(a, toParentId, id, toIndex);
    },
    invert() {
      return createReparentOp({
        id,
        fromParentId: toParentId,
        toParentId: fromParentId,
        fromIndex: toIndex,
        toIndex: fromIndex,
        label,
        coalesceKey,
      });
    },
  };
}

registerOpFactory<ReparentArgs>('reparent', (args) => createReparentOp(args));
