/**
 * Resolve a `units: 'bounds'` gradient into the frame its node is painted in.
 *
 * Node painters bake the pose into their geometry (`pathInPoseFrame`) rather
 * than emitting a per-node transform, so by the time the renderer sees a
 * scene node there is no node-local space left for a gradient to refer to.
 * This is the paint-side counterpart: it maps box-relative gradient geometry
 * onto the same box the path was just projected into, so the two arrive in
 * the renderer in one frame.
 */

import type { FillStyle, GradientFill } from './paint-types';

export interface FillPoseBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Map a `'bounds'` gradient's `0..1` geometry onto `box`, returning it in the
 * box's own frame (`units: 'local'`). Any other fill — solid, pattern, or a
 * gradient in another space — is returned untouched.
 *
 * Radii scale by the box's normalized diagonal, SVG's rule for a percentage
 * radius against `objectBoundingBox`: `sqrt(w² + h²) / sqrt(2)`, which is
 * exactly `w` for a square box. The renderer's radial gradient is circular,
 * so a non-square box cannot make it the ellipse SVG would — this keeps the
 * radius proportionate instead.
 */
export function fillInPoseFrame(fill: FillStyle, box: FillPoseBox): FillStyle {
  if (!isBoundsGradient(fill)) return fill;

  const toBox = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: box.x + p.x * box.width,
    y: box.y + p.y * box.height,
  });

  if (fill.fill === 'linear-gradient') {
    return { ...fill, from: toBox(fill.from), to: toBox(fill.to), units: 'local' as const };
  }
  if (fill.fill === 'radial-gradient') {
    const scale = Math.hypot(box.width, box.height) / Math.SQRT2;
    return { ...fill, center: toBox(fill.center), radius: fill.radius * scale, units: 'local' as const };
  }
  return { ...fill, center: toBox(fill.center), units: 'local' as const };
}

/**
 * Inverse of {@link fillInPoseFrame}: express a gradient already positioned
 * in `box`'s frame as `0..1` fractions of that box (`units: 'bounds'`), so
 * it follows the node when moved or resized.
 *
 * The importer's counterpart — SVG `userSpaceOnUse` coordinates arrive in
 * page space, and normalizing them here makes an imported gradient behave
 * exactly like one drawn in the app.
 *
 * A zero-width or zero-height box has no frame to normalize against; the
 * fill is returned untouched rather than divided by zero.
 */
export function fillToBoundsFrame(fill: FillStyle, box: FillPoseBox): FillStyle {
  const isGradient = fill.fill === 'linear-gradient'
    || fill.fill === 'radial-gradient'
    || fill.fill === 'conic-gradient';
  if (!isGradient) return fill;
  if (box.width === 0 || box.height === 0) return fill;

  const fromBox = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: (p.x - box.x) / box.width,
    y: (p.y - box.y) / box.height,
  });

  if (fill.fill === 'linear-gradient') {
    return { ...fill, from: fromBox(fill.from), to: fromBox(fill.to), units: 'bounds' as const };
  }
  if (fill.fill === 'radial-gradient') {
    const scale = Math.hypot(box.width, box.height) / Math.SQRT2;
    return { ...fill, center: fromBox(fill.center), radius: fill.radius / scale, units: 'bounds' as const };
  }
  return { ...fill, center: fromBox(fill.center), units: 'bounds' as const };
}

/** True when this fill is a gradient declaring box-relative geometry. */
function isBoundsGradient(fill: FillStyle | undefined): fill is GradientFill {
  if (fill === undefined) return false;
  const kind = fill.fill;
  if (kind !== 'linear-gradient' && kind !== 'radial-gradient' && kind !== 'conic-gradient') {
    return false;
  }
  return fill.units === 'bounds';
}
