import type { BoundsConstraint, ResizeAnchor, Bounds } from '@weasel-js/core';

/** `pose` grown to `min` on each axis `anchor` lets the drag move, holding
 *  the anchored edge: the dragged edge is pushed back rather than the node
 *  moved, and a box dragged past its anchor comes back to the minimum on the
 *  anchor's side. An axis whose minimum is 0 is not held, so it flips through
 *  its anchor as it would with no minimum. Extents are measured along
 *  `origin`'s sign, so a box stored flipped stays flipped. `null` when `pose`
 *  already meets it. */
export function clampToMinSize<TPose extends Bounds>(
  pose: TPose,
  anchor: ResizeAnchor,
  min: { width: number; height: number },
  origin?: Bounds,
): TPose | null {
  const x = clampAxis(pose.x, pose.width, anchor.x, min.width, signOf(origin?.width));
  const y = clampAxis(pose.y, pose.height, anchor.y, min.height, signOf(origin?.height));
  if (!x && !y) return null;
  return {
    ...pose,
    ...(x ? { x: x.at, width: x.extent } : {}),
    ...(y ? { y: y.at, height: y.extent } : {}),
  };
}

function signOf(v: number | undefined): 1 | -1 {
  return v !== undefined && v < 0 ? -1 : 1;
}

/** One axis held to `min` along `sign`, or `null` when it already meets it. */
function clampAxis(
  at: number,
  extent: number,
  side: ResizeAnchor['x'],
  min: number,
  sign: 1 | -1,
): { at: number; extent: number } | null {
  if (side === 'free' || !(min > 0) || extent * sign >= min) return null;
  // Anchored at 'min', the edge at `at` holds; at 'max', the edge at `at + extent`.
  const next = sign * min;
  return { at: side === 'max' ? at + extent - next : at, extent: next };
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
    onMove(ctx, { pose, anchor }) {
      const clamped = clampToMinSize(pose, anchor, min, ctx.origin.get(ctx.draggedIds[0]!));
      return clamped ? { pose: clamped } : undefined;
    },
  };
}
