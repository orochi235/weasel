import {
  createTransformOp,
  type ContainerBounds,
  type LayoutArrival,
  type LayoutChild,
  type LayoutContainer,
  type LayoutDragged,
  type LayoutSnap,
  type LayoutStrategy,
  type Op,
} from '@weasel-js/core';

/** What makes a sequence layout a row of slots or a shelf-packed flow. */
export interface Sequencer<TPose> {
  /** `children` in sequence, read off the poses they were given when the
   *  container was last arranged for `count` children. */
  order(
    container: LayoutContainer,
    children: ReadonlyArray<LayoutChild<TPose>>,
    count: number,
  ): LayoutChild<TPose>[];
  /** A pose for every child of `sequence`, or `null` when the container
   *  cannot hold them all. */
  place(container: LayoutContainer, sequence: ReadonlyArray<LayoutChild<TPose>>): Map<string, TPose> | null;
  /** The bounds the container takes to hold `sequence`, for one that sizes
   *  itself to its children. */
  resize?(container: LayoutContainer, sequence: ReadonlyArray<LayoutChild<TPose>>): ContainerBounds | undefined;
  centerOf(pose: TPose): { x: number; y: number };
  snap: LayoutSnap<TPose>;
  /** Labels for the two kinds of op a drop writes. */
  labels: { drop: string; shift: string };
}

interface IndexMeta {
  index: number;
}

/** The center of a `RectPose`, and the point itself for a point pose. */
export function defaultCenterOf(pose: unknown): { x: number; y: number } {
  const p = pose as { x?: number; y?: number; width?: number; height?: number };
  return { x: (p.x ?? 0) + (p.width ?? 0) / 2, y: (p.y ?? 0) + (p.height ?? 0) / 2 };
}

const withAt = <T,>(list: readonly T[], index: number, item: T): T[] => [
  ...list.slice(0, index),
  item,
  ...list.slice(index),
];

/** The container's sequence without the dragged child, which counted
 *  toward the last arrangement only if it came from here. */
function othersOf<TPose>(
  seq: Sequencer<TPose>,
  container: LayoutContainer,
  children: ReadonlyArray<LayoutChild<TPose>>,
  dragged: LayoutDragged<TPose>,
): LayoutChild<TPose>[] {
  const held = children.filter((c) => c.id !== dragged.id);
  const count = held.length + (dragged.sourceContainerId === container.id ? 1 : 0);
  return seq.order(container, held, count);
}

/** The index that lands `child` nearest where it is now, among those the container can hold. */
function nearestIndex<TPose>(
  seq: Sequencer<TPose>,
  container: LayoutContainer,
  sequence: ReadonlyArray<LayoutChild<TPose>>,
  child: LayoutChild<TPose>,
): number | null {
  const at = seq.centerOf(child.pose);
  let best: number | null = null;
  let bestD = Infinity;
  for (let i = 0; i <= sequence.length; i++) {
    const pose = seq.place(container, withAt(sequence, i, child))?.get(child.id);
    if (pose === undefined) continue;
    const p = seq.centerOf(pose);
    const d = (p.x - at.x) ** 2 + (p.y - at.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * The behavior every layout that keeps its children in one ordered sequence
 * shares: a drop inserts at an index and shifts the children after it, an
 * arrival goes in at the index that lands it nearest where it was put, and a
 * departure closes the gap. The `Sequencer` says what the order is and where
 * a sequence sits.
 */
export function sequenceLayout<TPose>(seq: Sequencer<TPose>): LayoutStrategy<TPose> {
  const { centerOf } = seq;

  const moved = (a: TPose, b: TPose): boolean => {
    const p = centerOf(a);
    const q = centerOf(b);
    return p.x !== q.x || p.y !== q.y;
  };

  const arranged = (
    container: LayoutContainer,
    sequence: ReadonlyArray<LayoutChild<TPose>>,
    poses: Map<string, TPose>,
  ): LayoutArrival<TPose> => {
    const bounds = seq.resize?.(container, sequence);
    return bounds ? { poses, bounds } : { poses };
  };

  /** Where the siblings sit once the dragged child takes the index `target` names. */
  const shifted: LayoutStrategy<TPose>['reflowPoses'] = (container, children, dragged, target) => {
    if (!target) return new Map();
    const others = othersOf(seq, container, children, dragged);
    const self = { id: dragged.id, pose: dragged.pose };
    const poses = seq.place(container, withAt(others, (target.meta as IndexMeta).index, self)) ?? new Map();
    poses.delete(dragged.id);
    return poses;
  };

  return {
    snap: seq.snap,

    childPoses(container, children) {
      const sequence = seq.order(container, children, children.length);
      return seq.place(container, sequence) ?? new Map(children.map((c) => [c.id, c.pose]));
    },

    getDropTargets(container, children, dragged) {
      const others = othersOf(seq, container, children, dragged);
      const self = { id: dragged.id, pose: dragged.pose };
      const targets = [];
      for (let index = 0; index <= others.length; index++) {
        const pose = seq.place(container, withAt(others, index, self))?.get(dragged.id);
        if (pose === undefined) continue;
        targets.push({ pose, origin: centerOf(pose), meta: { index } satisfies IndexMeta });
      }
      return targets;
    },

    reflowPoses: shifted,

    commitDrop(container, children, dragged, target) {
      const ops: Op[] = [];
      if (target) {
        const poses = shifted(container, children, dragged, target);
        for (const c of children) {
          const to = poses.get(c.id);
          if (to !== undefined && moved(c.pose, to)) {
            ops.push(createTransformOp<TPose>({ id: c.id, from: c.pose, to, label: seq.labels.shift }));
          }
        }
      }
      ops.push(
        createTransformOp<TPose>({
          id: dragged.id,
          from: dragged.originPose,
          to: target?.pose ?? dragged.pose,
          label: seq.labels.drop,
        }),
      );
      return ops;
    },

    arrive(container, children, arrivals) {
      const held = children.filter((c) => !arrivals.has(c.id));
      let sequence = seq.order(container, held, held.length);
      for (const c of children) {
        if (!arrivals.has(c.id)) continue;
        const index = nearestIndex(seq, container, sequence, c);
        if (index === null) return null;
        sequence = withAt(sequence, index, c);
      }
      const poses = seq.place(container, sequence);
      return poses && arranged(container, sequence, poses);
    },

    depart(container, children, departed) {
      const sequence = seq.order(container, children, children.length + departed.size);
      const poses = seq.place(container, sequence) ?? new Map<string, TPose>();
      return arranged(container, sequence, poses);
    },
  };
}
