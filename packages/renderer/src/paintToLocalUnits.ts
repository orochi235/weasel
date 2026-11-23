/**
 * Convert a paint between `units: 'bounds'` and `units: 'local'` against the box its node is painted in.
 * Node painters bake the pose into their geometry (`pathInPoseBox`) rather
 * than emitting a per-node transform, so by the time the renderer sees a
 * scene node there is no node-local space left for a gradient to refer to.
 */

import { isPatternPaint, type GradientPaint, type Paint, type PatternPaint, type PosedPaint } from '@weasel-js/paint';
import type { Rect } from '@weasel-js/geom';
import { getPaintDrawKind } from './paintKinds';

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
export function paintToLocalUnits(fill: Paint, box: Rect): PosedPaint {
  if (!isBuiltinKind(fill)) {
    return (getPaintDrawKind(fill.kind)?.toLocalUnits?.(fill, box) ?? fill) as PosedPaint;
  }
  if (isBoundsPattern(fill)) {
    const o = fill.origin ?? { x: 0, y: 0 };
    return { ...fill, origin: { x: box.x + o.x, y: box.y + o.y }, units: 'local' as const };
  }
  if (!isBoundsGradient(fill)) return fill as PosedPaint;

  const toBox = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: box.x + p.x * box.width,
    y: box.y + p.y * box.height,
  });

  if (fill.kind === 'linear-gradient') {
    const from = toBox(fill.from);
    const to = keepBands(fill.from, fill.to, 1 / box.width, 1 / box.height);
    return { ...fill, from, to: to ? toBox(to) : toBox(fill.to), units: 'local' as const };
  }
  if (fill.kind === 'radial-gradient') {
    const scale = Math.hypot(box.width, box.height) / Math.SQRT2;
    return { ...fill, center: toBox(fill.center), radius: fill.radius * scale, units: 'local' as const };
  }
  return { ...fill, center: toBox(fill.center), units: 'local' as const };
}

/**
 * Inverse of {@link paintToLocalUnits}: express a gradient already positioned
 * in `box`'s frame as `0..1` fractions of that box (`units: 'bounds'`), so
 * it follows the node when moved or resized. A paint already in `'bounds'`
 * units is returned untouched; any other is taken to be in `box`'s frame.
 *
 * A zero-width or zero-height box has no frame to normalize against; the
 * fill is returned untouched rather than divided by zero.
 */
export function paintToBoundsUnits(fill: Paint, box: Rect): Paint {
  if (!isBuiltinKind(fill)) {
    return getPaintDrawKind(fill.kind)?.toBoundsUnits?.(fill, box) ?? fill;
  }
  if ('units' in fill && fill.units === 'bounds') return fill;
  if (isPatternPaint(fill)) {
    const o = fill.origin ?? { x: 0, y: 0 };
    return { ...fill, origin: { x: o.x - box.x, y: o.y - box.y }, units: 'bounds' as const };
  }
  const isGradient = fill.kind === 'linear-gradient'
    || fill.kind === 'radial-gradient'
    || fill.kind === 'conic-gradient';
  if (!isGradient) return fill;
  if (box.width === 0 || box.height === 0) return fill;

  const fromBox = (p: { x: number; y: number }): { x: number; y: number } => ({
    x: (p.x - box.x) / box.width,
    y: (p.y - box.y) / box.height,
  });

  if (fill.kind === 'linear-gradient') {
    const to = keepBands(fill.from, fill.to, box.width, box.height);
    return { ...fill, from: fromBox(fill.from), to: fromBox(to ?? fill.to), units: 'bounds' as const };
  }
  if (fill.kind === 'radial-gradient') {
    const scale = Math.hypot(box.width, box.height) / Math.SQRT2;
    return { ...fill, center: fromBox(fill.center), radius: fill.radius / scale, units: 'bounds' as const };
  }
  return { ...fill, center: fromBox(fill.center), units: 'bounds' as const };
}

/**
 * The `to` that keeps a linear gradient's bands where they were once its space is scaled by `(1/sx, 1/sy)`,
 * as `fromBox` and `toBox` scale it. Mapping both ends alone tilts the bands on a non-square box, where
 * SVG's `objectBoundingBox` scales the whole gradient space and the bands lean with the box. `null` where
 * the gradient has no length or the scale is degenerate.
 */
function keepBands(
  from: { x: number; y: number }, to: { x: number; y: number }, sx: number, sy: number,
): { x: number; y: number } | null {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (dx === 0 || dy === 0) return to;
  const nx = dx * sx, ny = dy * sy;
  const k = (dx * dx + dy * dy) / (nx * nx + ny * ny);
  if (!Number.isFinite(k) || !Number.isFinite(sx) || !Number.isFinite(sy)) return null;
  return { x: from.x + dx * sx * sx * k, y: from.y + dy * sy * sy * k };
}

/** True when this fill is a pattern anchored to the painted node's box.
 *  Rebasing it is a translation only — a resize must reveal more tiles, not
 *  stretch them, which is the whole reason patterns get their own branch. */
function isBoundsPattern(
  fill: Paint,
): fill is PatternPaint {
  return isPatternPaint(fill) && fill.units === 'bounds';
}

/** True when this fill is a gradient declaring box-relative geometry. */
function isBoundsGradient(fill: Paint | undefined): fill is GradientPaint {
  if (fill === undefined) return false;
  const kind = fill.kind;
  if (kind !== 'linear-gradient' && kind !== 'radial-gradient' && kind !== 'conic-gradient') {
    return false;
  }
  return fill.units === 'bounds';
}

/** The kinds whose frame conversion is written above. Anything else is a
 *  registered kind and converts through its own entry. */
function isBuiltinKind(fill: Paint): boolean {
  const kind = fill.kind ?? 'solid';
  return kind === 'solid' || isPatternPaint(fill)
    || kind === 'linear-gradient' || kind === 'radial-gradient' || kind === 'conic-gradient';
}
