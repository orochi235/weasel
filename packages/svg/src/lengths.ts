/**
 * The one reader for a geometry attribute's length (`x`, `width`, `r`, …).
 *
 * A percentage resolves against the nearest `<svg>` ancestor's viewport, as
 * SVG has it, and an absolute CSS unit (`mm`, `pt`, …) converts at 96 per
 * inch. A font-relative unit is read as its bare number and reported.
 */

import { ABSOLUTE_PX } from './absoluteUnits';

const LENGTH = /^\s*([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)\s*([a-z%]*)\s*$/i;

/** Which viewport dimension a percentage is of. `'other'` is a length with no
 *  axis, like a radius: SVG's normalized diagonal, `sqrt((w² + h²) / 2)`. */
export type LengthAxis = 'x' | 'y' | 'other';

function viewportOf(el: Element): { width: number; height: number } | undefined {
  for (let e = el.parentElement; e; e = e.parentElement) {
    if (e.tagName.toLowerCase() !== 'svg') continue;
    const box = (e.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
    if (box.length === 4 && box.every(Number.isFinite)) return { width: box[2], height: box[3] };
    const w = LENGTH.exec(e.getAttribute('width') ?? '');
    const h = LENGTH.exec(e.getAttribute('height') ?? '');
    if (w && h && w[2] !== '%' && h[2] !== '%') return { width: userUnits(w), height: userUnits(h) };
    return undefined;
  }
  return undefined;
}

function userUnits(m: RegExpExecArray): number {
  return Number(m[1]) * (ABSOLUTE_PX[m[2].toLowerCase()] ?? 1);
}

export function readLength(
  el: Element,
  name: string,
  axis: LengthAxis,
  fallback: number,
  onWarn: (m: string) => void,
): number {
  return resolveLength(el.getAttribute(name), el, name, axis, fallback, onWarn);
}

/** {@link readLength} for a value already in hand: one inherited from another
 *  element, or a default. `el` is where a percentage is resolved from. */
export function resolveLength(
  raw: string | null,
  el: Element,
  name: string,
  axis: LengthAxis,
  fallback: number,
  onWarn: (m: string) => void,
): number {
  if (raw == null) return fallback;
  const m = LENGTH.exec(raw);
  if (!m) {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === '') return n;
  const scale = ABSOLUTE_PX[unit];
  if (scale != null) return n * scale;
  const tag = el.tagName.toLowerCase();
  if (unit !== '%') {
    onWarn(`<${tag} ${name}="${raw}"> unit "${unit}" is not converted; read as ${n}`);
    return n;
  }
  const view = viewportOf(el);
  if (!view) {
    onWarn(`<${tag} ${name}="${raw}"> has no viewport to be a percentage of; read as ${n}`);
    return n;
  }
  const of = axis === 'x' ? view.width
    : axis === 'y' ? view.height
      : Math.sqrt((view.width * view.width + view.height * view.height) / 2);
  return (n / 100) * of;
}
