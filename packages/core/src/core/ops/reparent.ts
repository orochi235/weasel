import type { Op } from './types';
import { registerOpFactory } from './registry';
import { captureSlot, resolveSlot, slotFromIndex, type OrderedReader, type Slot } from './slot';

interface ReparentAdapter extends OrderedReader {
  setParent(id: string, parentId: string | null): void;
  /** Sibling-order write, paired with `getChildren`. Optional: an adapter
   *  without both silently ignores slots and appends. */
  setChildOrder?(parentId: string | null, ids: string[]): void;
}

/** @internal */
interface ReparentArgs {
  id: string;
  fromParentId: string | null;
  toParentId: string | null;
  /** Sibling ordinal under the old parent. Sugar for `fromSlot: { index }`,
   *  and only a seed: `apply` re-observes the node's full slot through the
   *  adapter and that observation supersedes this. */
  fromIndex?: number;
  /** Sibling ordinal under the new parent. Sugar for `toSlot: { index }`.
   *  Omit to append. */
  toIndex?: number;
  /** Slot under the old parent, anchor included. `invert()` forwards it as
   *  the destination slot; without it undo re-parents with no position and
   *  the node lands last, quietly changing paint order. */
  fromSlot?: Slot;
  /** Slot under the new parent, anchor included. Omit to append. */
  toSlot?: Slot;
  label?: string;
  coalesceKey?: string;
}

/** Move `id` to `slot` among `parentId`'s children. No-op when the adapter
 *  has no ordering seam, when `id` isn't there, or when it's already in
 *  place. */
function placeAt(
  a: ReparentAdapter,
  parentId: string | null,
  id: string,
  slot: Slot,
): void {
  if (!a.getChildren || !a.setChildOrder) return;
  const current = a.getChildren(parentId);
  const from = current.indexOf(id);
  if (from < 0) return;
  const next = current.slice();
  next.splice(from, 1);
  const resolved = resolveSlot(next, slot);
  const to = resolved === undefined ? next.length : Math.max(0, Math.min(resolved, next.length));
  if (from === to) return;
  next.splice(to, 0, id);
  a.setChildOrder(parentId, next);
}

/** Present when the caller named a destination at all; `undefined` leaves
 *  placement to the adapter. */
function optionalSlot(slot: Slot | undefined, index: number | undefined): Slot | undefined {
  if (slot) return slot;
  return index === undefined ? undefined : slotFromIndex(index);
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
    id, fromParentId, toParentId,
    label = 'Reparent', coalesceKey = `reparent:${id}`,
  } = args;
  let fromSlot = optionalSlot(args.fromSlot, args.fromIndex);
  const toSlot = optionalSlot(args.toSlot, args.toIndex);
  const argsForSerial: ReparentArgs = {
    id, fromParentId, toParentId, fromSlot, toSlot, label, coalesceKey,
  };
  return {
    name: 'reparent',
    args: argsForSerial,
    label,
    coalesceKey,
    apply(adapter) {
      const a = adapter as ReparentAdapter;
      const observed = captureSlot(a, fromParentId, id);
      if (observed) {
        fromSlot = observed;
        argsForSerial.fromSlot = observed;
      }
      a.setParent(id, toParentId);
      if (toSlot) placeAt(a, toParentId, id, toSlot);
    },
    invert() {
      return createReparentOp({
        id,
        fromParentId: toParentId,
        toParentId: fromParentId,
        fromSlot: toSlot,
        toSlot: fromSlot,
        label,
        coalesceKey,
      });
    },
  };
}

registerOpFactory<ReparentArgs>('reparent', (args) => createReparentOp(args));
