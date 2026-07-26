import type {
  ModifierState,
  BoundsConstraint,
  ResizePose,
} from '../../../gestures/types';

type ModKey = keyof ModifierState;

/** Aspect-ratio lock: drag a corner/edge with `key` (default `'shift'`) held
 *  to keep the resized bounds at the start-pose's `width / height` ratio.
 *
 *  Strategy:
 *  - Compute the proposed deltas in width and height (signed, relative to
 *    origin). Whichever axis has the larger absolute delta "wins"; the other
 *    is recomputed from `(originW / originH) * winnerDelta`.
 *  - The opposite corner/edge stays anchored — for the corner case we infer
 *    the anchor from the proposed bounds; for an edge handle we resize the
 *    orthogonal axis symmetrically around the dragged edge's anchor (the
 *    handle's own line stays put, the orthogonal axis grows/shrinks centered
 *    on the un-dragged edge — see notes below).
 *  - No-op when the modifier is not held, when the origin has zero width or
 *    height (no defined ratio), or when the proposed pose hasn't moved.
 *
 *  Edge-handle handling: with `anchor.x !== 'free' && anchor.y === 'free'`
 *  (an `e` or `w` handle), only the width was driven by the pointer. We pick
 *  the new height as `width / ratio` and pin it to the un-dragged y axis by
 *  anchoring at the origin's top edge (`y` stays at `origin.y`). Symmetric
 *  for `n` / `s`.
 */
export function lockAspectWithModifier<TPose extends ResizePose>(opts: {
  key?: ModKey;
} = {}): BoundsConstraint<TPose> {
  const { key = 'shift' } = opts;

  return {
    onMove(ctx, { pose, anchor }) {
      if (!ctx.modifiers[key]) return;
      const origin = ctx.origin.get(ctx.draggedIds[0]) as ResizePose | undefined;
      if (!origin) return;
      if (origin.width === 0 || origin.height === 0) return;
      const ratio = origin.width / origin.height; // w / h

      // Signed deltas relative to origin. Negative deltas mean the user has
      // dragged through the anchor and flipped the rect; we preserve sign on
      // the recomputed axis so the flipped quadrant stays consistent.
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
        // sign-preserve width if the original height delta caused a flip.
        // (height-driven only; width direction follows ratio absolutely.)
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
        // Edge handle (n/s): width grew/shrunk via ratio. Center horizontally
        // about the origin's center so the rect stays visually centered on
        // the dragged edge's midline.
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
