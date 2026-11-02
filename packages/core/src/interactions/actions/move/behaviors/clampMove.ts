import { unionRects, type FramedBox, type Rect } from '@weasel-js/geom';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { MoveBehavior } from '../../../gestures/types';

/** What {@link clampMove} takes. */
export interface ClampMoveOptions<TPose> {
  /** The world rect the dragged nodes stay inside, or a function read each frame for one that changes. */
  bounds: FramedBox | (() => FramedBox);
  /** Reads each pose's box. Default `AUTO_POSE_DESCRIPTOR`. */
  poseDescriptor?: PoseDescriptor<TPose>;
}

/** The shift along one axis that keeps `[lo, hi]` moved by `d` inside `[min, max]`; a span wider
 *  than the range is held to its start. */
function clampAxis(d: number, lo: number, hi: number, min: number, max: number): number {
  if (hi + d > max) d = max - hi;
  if (lo + d < min) d = min - lo;
  return d;
}

/**
 * Move behavior that keeps the dragged nodes inside `bounds`: the drag's translation is
 * clamped so the box around every dragged node's start pose, moved by it, stays in the rect.
 * The clamp applies to the preview and the commit alike, so a node let go past an edge lands
 * on it. Put it after behaviors that reshape the translation, so it has the last word.
 */
export function clampMove<TPose>(opts: ClampMoveOptions<TPose>): MoveBehavior<TPose> {
  const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  return {
    onMove(ctx, proposed) {
      const b = typeof opts.bounds === 'function' ? opts.bounds() : opts.bounds;
      const starts: Rect[] = [];
      for (const id of ctx.draggedIds) {
        const pose = ctx.origin.get(id);
        if (pose !== undefined) starts.push(d.getBounds(pose));
      }
      const u = unionRects(starts);
      if (!u) return undefined;
      const x0 = u.x, y0 = u.y, x1 = u.x + u.width, y1 = u.y + u.height;
      const dx = clampAxis(proposed.dx, x0, x1, b.x, b.x + b.width);
      const dy = clampAxis(proposed.dy, y0, y1, b.y, b.y + b.height);
      if (dx === proposed.dx && dy === proposed.dy) return undefined;
      return { transform: { kind: 'translate', dx, dy } };
    },
  };
}
