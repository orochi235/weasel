import type {
  ModifierState,
  BoundsConstraint,
} from '../../../gestures/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';

type ModKey = keyof ModifierState;

/** Aspect-ratio lock: drag a corner/edge with `key` (default `'shift'`) held
 *  to keep the resized bounds at the start-pose's `width / height` ratio.
 *
 *  On a corner handle the axis with the larger absolute delta wins and the
 *  other follows from the ratio, with the opposite corner anchored. On an
 *  edge handle the driven axis sets the other, which stays centered on the
 *  origin. No-op when the origin has zero width or height.
 */
export function lockAspectWithModifier<TPose extends Bounds>(opts: {
  key?: ModKey;
} = {}): BoundsConstraint<TPose> {
  const { key = 'shift' } = opts;

  return {
    onMove(ctx, { pose, anchor }) {
      if (!ctx.modifiers[key]) return;
      const origin = ctx.origin.get(ctx.draggedIds[0]) as Bounds | undefined;
      if (!origin) return;
      if (origin.width === 0 || origin.height === 0) return;
      const ratio = origin.width / origin.height; // w / h

      const dw = pose.width - origin.width;
      const dh = pose.height - origin.height;

      let nw: number;
      let nh: number;

      if (anchor.x === 'free' && anchor.y === 'free') {
        // No driven axis — nothing to lock against.
        return;
      } else if (anchor.x === 'free') {
        // Edge handle: n or s. height is driven; width follows.
        nh = pose.height;
        nw = nh * ratio;
        if (nw < 0) nw = -nw;
      } else if (anchor.y === 'free') {
        // Edge handle: e or w. width is driven; height follows.
        nw = pose.width;
        nh = nw / ratio;
        if (nh < 0) nh = -nh;
      } else {
        // Corner handle. Pick the dominant axis by absolute delta.
        if (Math.abs(dw) >= Math.abs(dh)) {
          nw = pose.width;
          // Match height sign to width sign so the rect stays in the same
          // quadrant the pointer chose.
          nh = (Math.abs(nw) / ratio) * Math.sign(pose.height || 1);
        } else {
          nh = pose.height;
          nw = (Math.abs(nh) * ratio) * Math.sign(pose.width || 1);
        }
      }

      // Recompute x/y from the anchor (the un-dragged edge stays pinned).
      let nx = pose.x;
      let ny = pose.y;
      if (anchor.x === 'min') {
        // West edge anchored at origin.x.
        nx = origin.x;
      } else if (anchor.x === 'max') {
        // East edge anchored at origin.x + origin.width.
        nx = origin.x + origin.width - nw;
      } else {
        // Edge handle (n/s): center horizontally about the origin's center.
        nx = origin.x + origin.width / 2 - nw / 2;
      }
      if (anchor.y === 'min') {
        ny = origin.y;
      } else if (anchor.y === 'max') {
        ny = origin.y + origin.height - nh;
      } else {
        ny = origin.y + origin.height / 2 - nh / 2;
      }

      return {
        pose: { ...pose, x: nx, y: ny, width: nw, height: nh },
      };
    },
  };
}
