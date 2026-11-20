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

/** `pose`, put in `origin` scaled by one factor on every axis as an aspect lock
 *  leaves it, grown so each axis meets `min`. The axes `anchor` holds keep their
 *  anchored edge, and a free axis its center. The factor keeps its sign unless an
 *  anchored axis has a minimum of its own, which a box dragged past its anchor
 *  comes back to as {@link clampToMinSize} does. `null` when `pose` already meets
 *  it. */
export function clampToMinSizeKeepingAspect<TPose extends Bounds>(
  pose: TPose,
  anchor: ResizeAnchor,
  min: { width: number; height: number },
  origin: Bounds,
): TPose | null {
  const axes = [
    { side: anchor.x, at: pose.x, extent: pose.width, from: origin.width, min: min.width },
    { side: anchor.y, at: pose.y, extent: pose.height, from: origin.height, min: min.height },
  ];
  const driven = axes.filter((a) => a.side !== 'free' && a.from !== 0);
  if (driven.length === 0) return clampToMinSize(pose, anchor, min, origin);
  const scale = driven.map((a) => a.extent / a.from).reduce((s, t) => (Math.abs(t) > Math.abs(s) ? t : s));
  const least = Math.max(0, ...axes.map((a) => (a.min > 0 && a.from !== 0 ? a.min / Math.abs(a.from) : 0)));
  const unflip = driven.some((a) => a.min > 0);
  const next = unflip ? Math.max(scale, least) : Math.sign(scale || 1) * Math.max(Math.abs(scale), least);
  if (next === scale) return null;
  const [x, y] = axes.map((a) => {
    if (a.side === 'free') {
      const extent = Math.abs(next * a.from) * signOf(a.extent);
      return { at: a.at + a.extent / 2 - extent / 2, extent };
    }
    const extent = next * a.from;
    return { at: a.side === 'max' ? a.at + a.extent - extent : a.at, extent };
  });
  return { ...pose, x: x!.at, width: x!.extent, y: y!.at, height: y!.extent };
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
