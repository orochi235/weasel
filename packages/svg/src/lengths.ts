/**
 * The one reader for a geometry attribute's length (`x`, `width`, `r`, …).
 *
 * A percentage resolves against the nearest `<svg>` ancestor's viewport, as
 * SVG has it, and an absolute CSS unit (`mm`, `pt`, …) converts at 96 per
 * inch. An `em` or `ex` is of the element's computed font size.
 */

import { ABSOLUTE_PX } from './absoluteUnits';
import { emsPer, fontSizeOf } from './fontSize';
import { styleAt } from './styleAt';
import { parseViewBoxAttr } from './viewBox';

const LENGTH = /^\s*([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)\s*([a-z%]*)\s*$/i;

/** Which viewport dimension a percentage is of. `'other'` is a length with no
 *  axis, like a radius: SVG's normalized diagonal, `sqrt((w² + h²) / 2)`. */
export type LengthAxis = 'x' | 'y' | 'other';

function viewportOf(el: Element): { width: number; height: number } | undefined {
  for (let e = el.parentElement; e; e = e.parentElement) {
    if (e.tagName.toLowerCase() !== 'svg') continue;
    const box = parseViewBoxAttr(e.getAttribute('viewBox'));
    if (box) return { width: box.width, height: box.height };
    const w = e.getAttribute('width');
    const h = e.getAttribute('height');
    if (w == null || h == null || LENGTH.exec(w)?.[2] === '%' || LENGTH.exec(h)?.[2] === '%') return undefined;
    const quiet = (): void => {};
    const width = resolveLength(w, e, 'width', 'x', NaN, quiet);
    const height = resolveLength(h, e, 'height', 'y', NaN, quiet);
    return Number.isFinite(width) && Number.isFinite(height) ? { width, height } : undefined;
  }
  return undefined;
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
  const n = lengthOf(raw, el, name, axis, onWarn);
  return Number.isFinite(n) ? n : fallback;
}

function lengthOf(raw: string, el: Element, name: string, axis: LengthAxis, onWarn: (m: string) => void): number {
  const m = LENGTH.exec(raw);
  if (!m) return parseFloat(raw);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === '') return n;
  const scale = ABSOLUTE_PX[unit];
  if (scale != null) return n * scale;
  const ems = emsPer(unit);
  if (ems != null) return n * ems * fontSizeOf(styleAt(el));
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
