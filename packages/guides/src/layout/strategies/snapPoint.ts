import {
  type Vec2,
  createTransformOp,
  type LayoutSnap,
  type LayoutStrategy,
} from '@weasel-js/core';
import { nearestWithin } from '../snaps';

/** Which points within a container a child can snap to. */
export type SnapPattern = 'corners' | 'edges' | 'center' | 'grid';

/** Options for `snapPoint`. */
export interface SnapPointOptions<TPose> {
  pattern: SnapPattern;
  /** Spacing for the 'grid' pattern, in world units. Default 50; one that is
   *  not a positive finite number offers no points. A grid of more than 129 × 129 points
   *  offers only the 129 × 129 around the dragged child's pose, none past
   *  its far edges. */
  gridSpacing?: number;
  /** Tolerance for the default snap policy (nearestWithin). Default Infinity. */
  tolerance?: number;
  snap?: LayoutSnap<TPose>;
}

/** Grid points either side of the dragged pose, on each axis, that a grid too dense to list whole offers. */
const GRID_REACH = 64;

/** The grid lines `[lo, hi]` of `count + 1` (0 to `count`) that one axis offers, around `at` when there are too many. */
function gridRange(count: number, at: number): [number, number] {
  if (count <= 2 * GRID_REACH) return [0, count];
  const mid = Math.min(Math.max(Math.round(at), GRID_REACH), count - GRID_REACH);
  return [mid - GRID_REACH, mid + GRID_REACH];
}

function buildPoints(
  bounds: { x: number; y: number; width: number; height: number },
  pattern: SnapPattern,
  gridSpacing: number,
  near: Vec2,
): Vec2[] {
  switch (pattern) {
    case 'corners':
      return [
        { x: bounds.x, y: bounds.y },
        { x: bounds.x + bounds.width, y: bounds.y },
        { x: bounds.x, y: bounds.y + bounds.height },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      ];
    case 'edges':
      return [
        { x: bounds.x + bounds.width / 2, y: bounds.y },
        { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height },
        { x: bounds.x, y: bounds.y + bounds.height / 2 },
        { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2 },
      ];
    case 'center':
      return [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }];
    case 'grid': {
      const out: Vec2[] = [];
      if (!(gridSpacing > 0 && gridSpacing < Infinity)) return out;
      const [i0, i1] = gridRange(Math.floor(bounds.width / gridSpacing), (near.x - bounds.x) / gridSpacing);
      const [j0, j1] = gridRange(Math.floor(bounds.height / gridSpacing), (near.y - bounds.y) / gridSpacing);
      // Written so a NaN range, which a non-finite container gives, offers nothing too.
      if (!(i1 - i0 <= 2 * GRID_REACH && j1 - j0 <= 2 * GRID_REACH)) return out;
      // Counted from 0, since `i++` from an index past a safe integer never moves.
      for (let dj = 0; dj <= j1 - j0; dj++) {
        for (let di = 0; di <= i1 - i0; di++) {
          const p = { x: bounds.x + (i0 + di) * gridSpacing, y: bounds.y + (j0 + dj) * gridSpacing };
          // Far along an axis cut finer than a double counts, the last index rounds past the far edge.
          if (p.x <= bounds.x + bounds.width && p.y <= bounds.y + bounds.height) out.push(p);
        }
      }
      return out;
    }
  }
}

/** Layout strategy that leaves children where they are but offers a fixed set
 *  of points — corners, edge midpoints, center, or a grid — for a dragged
 *  child to land on. */
export function snapPoint<TPose extends Vec2>(
  opts: SnapPointOptions<TPose>,
): LayoutStrategy<TPose> {
  const gridSpacing = opts.gridSpacing ?? 50;
  const tolerance = opts.tolerance ?? Infinity;
  const snap = opts.snap ?? nearestWithin<TPose>({ tolerance });

  return {
    snap,

    childPoses(_container, children) {
      const out = new Map<string, TPose>();
      for (const c of children) out.set(c.id, c.pose);
      return out;
    },

    getDropTargets(container, _children, dragged) {
      const points = buildPoints(container.bounds, opts.pattern, gridSpacing, dragged.pose);
      return points.map((p) => ({
        // Anchor the dragged child's top-left at the snap point.
        pose: { ...dragged.pose, x: p.x, y: p.y } as TPose,
        origin: p,
      }));
    },

    reflowPoses() {
      return new Map();
    },

    commitDrop(_container, _children, dragged, target) {
      const to = target === null ? dragged.pose : target.pose;
      return [
        createTransformOp<TPose>({
          id: dragged.id,
          from: dragged.originPose,
          to,
          label: 'Snap drop',
        }),
      ];
    },
  };
}
