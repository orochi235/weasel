import { poseFrameInverseOf, poseFrameOf, poseLinearOf, transformPoint, type Affine, type FramedRect } from '@weasel-js/geom';
import type { PoseDescriptor, MoveBehavior } from '@weasel-js/core/engine';
import { AUTO_POSE_DESCRIPTOR } from '@weasel-js/core/engine';

/** What {@link clampMove} takes. */
export interface ClampMoveOptions<TPose> {
  /** The world rect the dragged nodes stay inside, or a function read each frame for one that changes. */
  bounds: FramedRect | (() => FramedRect);
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

/** The corners of `pose`'s box as it is drawn, turned and transformed by the pose's own frame. */
function drawnCorners<TPose>(d: PoseDescriptor<TPose>, pose: TPose): [number, number][] {
  const r = d.getBounds(pose);
  const frame = poseFrameOf({ ...r, rotation: d.getRotation?.(pose) ?? 0, transform: poseLinearOf(pose) ?? undefined });
  const corners: [number, number][] = [[r.x, r.y], [r.x + r.width, r.y], [r.x + r.width, r.y + r.height], [r.x, r.y + r.height]];
  return frame ? corners.map(([x, y]) => transformPoint(frame, x, y)) : corners;
}

/** `(dx, dy)` through `m`'s linear part. */
const linearOf = (m: Affine | null, dx: number, dy: number): [number, number] =>
  (m ? [m[0] * dx + m[2] * dy, m[1] * dx + m[3] * dy] : [dx, dy]);

/**
 * Move behavior that keeps the dragged nodes inside `bounds`: the drag's translation is
 * clamped so every dragged node's start box in world, as drawn and moved by it, stays in the
 * rect as drawn, turned by its `rotation` and `transform`. A `bounds` whose `transform` is
 * singular holds the nodes where they started. The clamp applies to the preview and the commit
 * alike, so a node let go past an edge lands on it. Put it after behaviors that reshape the
 * translation, so it has the last word.
 */
export function clampMove<TPose>(opts: ClampMoveOptions<TPose>): MoveBehavior<TPose> {
  const d = (opts.poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  return {
    onMove(ctx, proposed) {
      const b = typeof opts.bounds === 'function' ? opts.bounds() : opts.bounds;
      const frame = poseFrameOf(b);
      const back = frame ? poseFrameInverseOf(b) : null;
      if (frame && !back) {
        return proposed.dx === 0 && proposed.dy === 0 ? undefined : { transform: { kind: 'translate', dx: 0, dy: 0 } };
      }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const id of ctx.draggedIds) {
        const pose = ctx.origin.get(id);
        if (pose === undefined) continue;
        for (const [wx, wy] of drawnCorners(d, ctx.frames ? ctx.frames.toWorld(id, pose) : pose)) {
          const [x, y] = back ? transformPoint(back, wx, wy) : [wx, wy];
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
      }
      if (x0 > x1) return undefined;
      const [lx, ly] = linearOf(back, proposed.dx, proposed.dy);
      const cx = clampAxis(lx, x0, x1, b.x, b.x + b.width);
      const cy = clampAxis(ly, y0, y1, b.y, b.y + b.height);
      if (cx === lx && cy === ly) return undefined;
      const [dx, dy] = linearOf(frame, cx, cy);
      return { transform: { kind: 'translate', dx, dy } };
    },
  };
}
