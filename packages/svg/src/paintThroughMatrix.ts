/**
 * Take a paint or stroke that SVG states in user space through the matrix its
 * element's geometry was baked with, so the two stay registered.
 */
import type { Paint } from '@weasel-js/core';
import type { Matrix, SvgPaint, SvgStroke } from './types';
import { applyMatrix } from './transform';
import { scaleStroke } from './metricScale';

/** `sqrt(|det|)`: the factor a length takes under `m`, exact when `m` scales
 *  both axes alike. */
export function uniformScaleOf(m: Matrix): number {
  return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
}

/** Does `m` scale one axis more than the other, or skew? */
export function isNonUniform(m: Matrix): boolean {
  const [a, b, c, d] = m;
  const n = Math.hypot(a, b, c, d);
  // A similarity's columns are perpendicular and equally long.
  return Math.abs(a * c + b * d) > 1e-4 * n * n
    || Math.abs(Math.hypot(a, b) - Math.hypot(c, d)) > 1e-4 * n;
}

/** A gradient placed in coordinates (`units: 'world'`, or `'local'` to its
 *  node) with its geometry mapped through `m`. A `'bounds'` one follows the
 *  box by itself and passes through. */
export function fillThroughMatrix(fill: Paint, m: Matrix): Paint {
  if (!('units' in fill) || (fill.units !== 'world' && fill.units !== 'local')) return fill;
  const at = (p: { x: number; y: number }): { x: number; y: number } => applyMatrix(m, p.x, p.y);
  if (fill.kind === 'linear-gradient') return { ...fill, from: at(fill.from), to: at(fill.to) };
  if (fill.kind === 'radial-gradient') {
    return { ...fill, center: at(fill.center), radius: fill.radius * uniformScaleOf(m) };
  }
  if (fill.kind === 'conic-gradient') return { ...fill, center: at(fill.center) };
  return fill;
}

export function paintThroughMatrix(paint: SvgPaint, m: Matrix): SvgPaint {
  return paint.kind === 'gradient' ? { ...paint, paint: fillThroughMatrix(paint.paint, m) } : paint;
}

export function strokeThroughMatrix(stroke: SvgStroke, m: Matrix): SvgStroke {
  return { ...scaleStroke(stroke, uniformScaleOf(m)), paint: paintThroughMatrix(stroke.paint, m) };
}
