import type { BoundsConstraint, ResizeAnchor } from '../../../gestures/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';

/** `pose` grown to `min` on each axis `anchor` lets the drag move, holding
 *  the anchored edge: the dragged edge is pushed back rather than the node
 *  moved, and a box dragged past its anchor comes back to the minimum on the
 *  anchor's side. `null` when `pose` already meets it. */
export function clampToMinSize<TPose extends Bounds>(
  pose: TPose,
  anchor: ResizeAnchor,
  min: { width: number; height: number },
): TPose | null {
  let { x, y, width, height } = pose;
  let changed = false;
  if (anchor.x !== 'free' && width < min.width) {
    // Anchored west, the east edge was dragged: hold x. Anchored east, hold
    // the right edge.
    if (anchor.x === 'max') x += width - min.width;
    width = min.width;
    changed = true;
  }
  if (anchor.y !== 'free' && height < min.height) {
    if (anchor.y === 'max') y += height - min.height;
    height = min.height;
    changed = true;
  }
  return changed ? { ...pose, x, y, width, height } : null;
}

/** Resize constraint that stops a node shrinking past a minimum. The anchored
 *  edge stays put, so clamping pushes the dragged edge back rather than moving
 *  the node. */
export function clampMinSize<TPose extends Bounds>(args: {
  minWidth: number;
  minHeight: number;
}): BoundsConstraint<TPose> {
  const min = { width: args.minWidth, height: args.minHeight };
  return {
    onMove(_ctx, { pose, anchor }) {
      const clamped = clampToMinSize(pose, anchor, min);
      return clamped ? { pose: clamped } : undefined;
    },
  };
}
