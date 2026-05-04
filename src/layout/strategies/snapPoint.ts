import { createTransformOp } from '../../core/ops/transform';
import type { LayoutSnap, LayoutStrategy } from '../types';
import { nearestWithin } from '../snaps';

export interface SnapPointOptions<TPose> {
  pattern: 'corners' | 'edges' | 'center' | 'grid';
  /** Spacing for the 'grid' pattern, in world units. Default 50. */
  gridSpacing?: number;
  /** Tolerance for the default snap policy (nearestWithin). Default Infinity. */
  tolerance?: number;
  snap?: LayoutSnap<TPose>;
}

type Pt = { x: number; y: number };

function buildPoints(
  bounds: { x: number; y: number; width: number; height: number },
  pattern: SnapPointOptions<unknown>['pattern'],
  gridSpacing: number,
): Pt[] {
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
      const out: Pt[] = [];
      for (let y = bounds.y; y <= bounds.y + bounds.height + 1e-9; y += gridSpacing) {
        for (let x = bounds.x; x <= bounds.x + bounds.width + 1e-9; x += gridSpacing) {
          out.push({ x, y });
        }
      }
      return out;
    }
  }
}

export function snapPoint<TPose extends Pt>(
  opts: SnapPointOptions<TPose>,
): LayoutStrategy<TPose> {
  const gridSpacing = opts.gridSpacing ?? 50;
  const tolerance = opts.tolerance ?? Infinity;
  const snap = opts.snap ?? nearestWithin<TPose>({ tolerance });

  return {
    snap,

    getChildPositions(_container, children) {
      const out = new Map<string, TPose>();
      for (const c of children) out.set(c.id, c.pose);
      return out;
    },

    getDropTargets(container, _children, dragged) {
      const points = buildPoints(container.bounds, opts.pattern, gridSpacing);
      return points.map((p) => ({
        // Anchor the dragged child's top-left at the snap point.
        pose: { ...dragged.pose, x: p.x, y: p.y } as TPose,
        origin: p,
      }));
    },

    reflowFor() {
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
