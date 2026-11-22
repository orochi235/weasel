/**
 * Take a paint or stroke that SVG states in user space through the matrix its
 * element's geometry was baked with, so the two stay registered.
 */
import { isPatternPaint, type Paint } from '@weasel-js/core';
import type { Matrix, SvgPaint, SvgStroke } from './types';
import { applyMatrix } from './transform';
import { scaleStroke } from './metricScale';
import { carryUserScale } from './userScale';

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

/** A gradient or pattern placed in coordinates (`units: 'world'`, or
 *  `'local'` to its node) with its geometry mapped through `m`. A `'bounds'`
 *  one follows the box by itself and passes through. `onWarn` hears what `m`
 *  does to one that the paint cannot hold. */
export function fillThroughMatrix(fill: Paint, m: Matrix, onWarn?: (message: string) => void): Paint {
  if (!('units' in fill) || (fill.units !== 'world' && fill.units !== 'local')) return fill;
  const at = (p: { x: number; y: number }): { x: number; y: number } => applyMatrix(m, p.x, p.y);
  if (isPatternPaint(fill)) {
    const [a, b, c, d] = fill.transform ?? [1, 0, 0, 1];
    const transform = [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d] as const;
    const { transform: _t, origin: _o, ...rest } = fill;
    const origin = at(fill.origin ?? { x: 0, y: 0 });
    const identity = transform[0] === 1 && transform[1] === 0 && transform[2] === 0 && transform[3] === 1;
    return { ...rest, ...(origin.x === 0 && origin.y === 0 ? {} : { origin }), ...(identity ? {} : { transform }) };
  }
  const similar = !isNonUniform(m);
  if (fill.kind === 'linear-gradient') {
    return { ...fill, from: at(fill.from), to: similar ? at(fill.to) : linearEnd(fill.from, fill.to, m) };
  }
  if (fill.kind === 'radial-gradient') {
    if (!similar) onWarn?.('a radial gradient under a skew or non-uniform scale is painted circular, at the uniform part of its radius');
    return { ...fill, center: at(fill.center), radius: fill.radius * uniformScaleOf(m) };
  }
  if (fill.kind === 'conic-gradient') {
    if (!similar || m[0] * m[3] - m[1] * m[2] < 0) {
      onWarn?.('a conic gradient under a skew, a non-uniform scale or a mirror keeps its sweep as drawn, turned only');
    }
    return { ...fill, center: at(fill.center), angle: fill.angle + Math.atan2(m[1], m[0]) };
  }
  return fill;
}

/** Where a linear gradient from `from` to `to` ends once `m` maps it: its
 *  isolines stay lines, but under a skew or a non-uniform scale they no longer
 *  stand square to the mapped `from`–`to`, so the end is found from them. */
function linearEnd(from: { x: number; y: number }, to: { x: number; y: number }, m: Matrix): { x: number; y: number } {
  const [a, b, c, d] = m;
  const det = a * d - b * c;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len2 = dx * dx + dy * dy;
  const start = applyMatrix(m, from.x, from.y);
  if (det === 0 || len2 === 0) return applyMatrix(m, to.x, to.y);
  // The gradient's direction through the inverse transpose of `m`'s linear part.
  const wx = (d * dx - b * dy) / det / len2;
  const wy = (-c * dx + a * dy) / det / len2;
  const w2 = wx * wx + wy * wy;
  return { x: start.x + wx / w2, y: start.y + wy / w2 };
}

const GRADIENTS = new Set(['linear-gradient', 'radial-gradient', 'conic-gradient']);

/** Whether `paint` is a gradient or pattern placed in the document's space: `'world'`, or `'screen'` or
 *  unstated, which a document has no screen for and reads as at an unmoved view. A `'local'` one is in its node's. */
export function inDocumentSpace(paint: Paint): boolean {
  if (!(GRADIENTS.has(paint.kind as string) || isPatternPaint(paint))) return false;
  const units = (paint as { units?: string }).units;
  return units !== 'local' && units !== 'bounds';
}

/** A paint {@link inDocumentSpace} taken into the frame `back` maps the document into, keeping its
 *  `units`; any other paint as it is. */
export function documentPaintThrough(paint: Paint, back: Matrix, onWarn?: (message: string) => void): Paint {
  if (!inDocumentSpace(paint)) return paint;
  const units = (paint as { units?: string }).units;
  const mapped = fillThroughMatrix({ ...paint, units: 'world' } as Paint, back, onWarn) as { units?: string };
  if (units === undefined) delete mapped.units;
  else mapped.units = units;
  return mapped as Paint;
}

export function paintThroughMatrix(paint: SvgPaint, m: Matrix, onWarn?: (message: string) => void): SvgPaint {
  return paint.kind === 'gradient' ? { ...paint, paint: fillThroughMatrix(paint.paint, m, onWarn) } : paint;
}

export function strokeThroughMatrix(stroke: SvgStroke, m: Matrix, onWarn?: (message: string) => void): SvgStroke {
  const scaled = scaleStroke(stroke, uniformScaleOf(m));
  return carryUserScale(scaled, { ...scaled, paint: paintThroughMatrix(stroke.paint, m, onWarn) });
}
