import type { LayoutSnap, LayoutStrategy } from '@weasel-js/core';
import { nearest } from '../snaps';
import type { Arrangement, Slot } from './arrangements';
import { defaultCenterOf, sequenceLayout } from './sequence';

/** Options for `slots`. */
export interface SlotsOptions<TPose> {
  /** Where the slots are for a given child count: `rowSlots`, `gridSlots`,
   *  `ringSlots`, or a function of your own. */
  arrangement: Arrangement;
  /** Which slot a drag means. Default `nearest()`. */
  snap?: LayoutSnap<TPose>;
  /** The pose a child takes in a slot. Default centers the child's own
   *  `width`/`height` on the slot and keeps every other field. */
  slotToPose?(slot: Slot, pose: TPose): TPose;
  /** The point that decides which slot a child sits in. Default is the
   *  center of a `RectPose`, and the point itself for a point pose. */
  centerOf?(pose: TPose): { x: number; y: number };
}

function defaultSlotToPose<TPose>(slot: Slot, pose: TPose): TPose {
  const { width = 0, height = 0 } = pose as { width?: number; height?: number };
  return { ...(pose as object), x: slot.x - width / 2, y: slot.y - height / 2 } as TPose;
}

function nearestSlot(at: { x: number; y: number }, places: readonly Slot[]): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < places.length; i++) {
    const d = (places[i]!.x - at.x) ** 2 + (places[i]!.y - at.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Layout strategy that keeps its children in a sequence of slots — a row, a
 * grid, a ring — whose positions depend on how many children there are, so
 * the arrangement re-spaces itself as children come and go.
 *
 * A child's place in the sequence is the slot it sits nearest. Dropping a
 * drag on a slot inserts it there and shifts the children between; a drag
 * from outside is offered one slot more than the container holds. An insert
 * or reparent lands at the slot nearest where the child was put.
 */
export function slots<TPose>(opts: SlotsOptions<TPose>): LayoutStrategy<TPose> {
  const { arrangement } = opts;
  const slotToPose = opts.slotToPose ?? defaultSlotToPose;
  const centerOf = opts.centerOf ?? defaultCenterOf;

  return sequenceLayout<TPose>({
    snap: opts.snap ?? nearest<TPose>(),
    centerOf,
    labels: { drop: 'Slot drop', shift: 'Slot shift' },

    // Ties break by id, so a container nobody has arranged yet still has an order.
    order(container, children, count) {
      const places = arrangement(container.bounds, count);
      return children
        .map((c) => ({ c, slot: nearestSlot(centerOf(c.pose), places) }))
        .sort((a, b) => a.slot - b.slot || (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0))
        .map((e) => e.c);
    },

    place(container, sequence) {
      const places = arrangement(container.bounds, sequence.length);
      if (places.length < sequence.length) return null;
      return new Map(sequence.map((c, i) => [c.id, slotToPose(places[i]!, c.pose)]));
    },
  });
}
