import {
  createTransformOp,
  type LayoutArrival,
  type LayoutChild,
  type LayoutContainer,
  type LayoutDragged,
  type LayoutSnap,
  type LayoutStrategy,
  type Op,
} from '@weasel-js/core';
import { nearest } from '../snaps';
import type { Arrangement, Slot } from './arrangements';

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

interface SlotMeta {
  index: number;
}

type Size = { width?: number; height?: number };

function defaultCenterOf(pose: unknown): { x: number; y: number } {
  const p = pose as { x?: number; y?: number } & Size;
  return { x: (p.x ?? 0) + (p.width ?? 0) / 2, y: (p.y ?? 0) + (p.height ?? 0) / 2 };
}

function defaultSlotToPose<TPose>(slot: Slot, pose: TPose): TPose {
  const { width = 0, height = 0 } = pose as Size;
  return { ...(pose as object), x: slot.x - width / 2, y: slot.y - height / 2 } as TPose;
}

function nearestIndex(at: { x: number; y: number }, places: readonly Slot[]): number {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < places.length; i++) {
    const dx = places[i]!.x - at.x;
    const dy = places[i]!.y - at.y;
    const d = dx * dx + dy * dy;
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
  const snap = opts.snap ?? nearest<TPose>();
  const slotToPose = opts.slotToPose ?? defaultSlotToPose;
  const centerOf = opts.centerOf ?? defaultCenterOf;

  /** `children` in sequence: by the slot each sits nearest among `places`,
   *  ties by id, so a container nobody has arranged yet still has an order. */
  function ordered(children: ReadonlyArray<LayoutChild<TPose>>, places: readonly Slot[]): LayoutChild<TPose>[] {
    return children
      .map((c) => ({ c, slot: nearestIndex(centerOf(c.pose), places) }))
      .sort((a, b) => a.slot - b.slot || (a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0))
      .map((e) => e.c);
  }

  function place(sequence: ReadonlyArray<LayoutChild<TPose>>, places: readonly Slot[]): Map<string, TPose> {
    const out = new Map<string, TPose>();
    sequence.forEach((c, i) => {
      if (places[i]) out.set(c.id, slotToPose(places[i], c.pose));
    });
    return out;
  }

  /** The container's sequence without the dragged child, and the slots it
   *  will have with that child in it. Null when the arrangement has no slot
   *  for one more. */
  function dropOf(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
    dragged: LayoutDragged<TPose>,
  ): { others: LayoutChild<TPose>[]; places: Slot[] } | null {
    const held = children.filter((c) => c.id !== dragged.id);
    // Measured against the arrangement the children were last placed in,
    // which counted the dragged child only if it came from here.
    const count = held.length + (dragged.sourceContainerId === container.id ? 1 : 0);
    const others = ordered(held, arrangement(container.bounds, count));
    const places = arrangement(container.bounds, others.length + 1);
    return places.length > others.length ? { others, places } : null;
  }

  /** Where the siblings go once the dragged child takes the slot `meta` names. */
  function shifted(drop: { others: LayoutChild<TPose>[]; places: Slot[] }, meta: SlotMeta): Map<string, TPose> {
    const out = new Map<string, TPose>();
    drop.others.forEach((c, i) => {
      out.set(c.id, slotToPose(drop.places[i < meta.index ? i : i + 1]!, c.pose));
    });
    return out;
  }

  const moved = (a: TPose, b: TPose): boolean => {
    const p = centerOf(a);
    const q = centerOf(b);
    return p.x !== q.x || p.y !== q.y;
  };

  return {
    snap,

    childPoses(container, children) {
      const places = arrangement(container.bounds, children.length);
      return place(ordered(children, places), places);
    },

    getDropTargets(container, children, dragged) {
      const drop = dropOf(container, children, dragged);
      if (!drop) return [];
      return drop.places.map((slot, index) => ({
        pose: slotToPose(slot, dragged.pose),
        origin: { x: slot.x, y: slot.y },
        meta: { index } satisfies SlotMeta,
      }));
    },

    reflowPoses(container, children, dragged, target) {
      const drop = target && dropOf(container, children, dragged);
      return drop ? shifted(drop, target.meta as SlotMeta) : new Map();
    },

    commitDrop(container, children, dragged, target) {
      const ops: Op[] = [];
      const drop = target && dropOf(container, children, dragged);
      if (drop) {
        const poses = shifted(drop, target.meta as SlotMeta);
        for (const c of drop.others) {
          const to = poses.get(c.id)!;
          if (moved(c.pose, to)) {
            ops.push(createTransformOp<TPose>({ id: c.id, from: c.pose, to, label: 'Slot shift' }));
          }
        }
      }
      ops.push(
        createTransformOp<TPose>({
          id: dragged.id,
          from: dragged.originPose,
          to: target?.pose ?? dragged.pose,
          label: 'Slot drop',
        }),
      );
      return ops;
    },

    arrive(container, children, arrivals): LayoutArrival<TPose> | null {
      const places = arrangement(container.bounds, children.length);
      if (places.length < children.length) return null;
      const held = children.filter((c) => !arrivals.has(c.id));
      const sequence = ordered(held, arrangement(container.bounds, held.length));
      for (const c of children) {
        if (!arrivals.has(c.id)) continue;
        const index = Math.min(nearestIndex(centerOf(c.pose), places), sequence.length);
        sequence.splice(index, 0, c);
      }
      return { poses: place(sequence, places) };
    },

    depart(container, children, departed): LayoutArrival<TPose> {
      const before = arrangement(container.bounds, children.length + departed.size);
      return { poses: place(ordered(children, before), arrangement(container.bounds, children.length)) };
    },
  };
}
