/**
 * The one reader for a geometry attribute's length (`x`, `width`, `r`, …).
 *
 * A percentage resolves against the nearest `<svg>` ancestor's viewport, as
 * SVG has it. Any other unit is read as its bare number and reported: this
 * package converts no CSS units, on geometry or on `stroke-width`.
 */

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
    if (w && h && w[2] !== '%' && h[2] !== '%') return { width: Number(w[1]), height: Number(h[1]) };
    return undefined;
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
  const raw = el.getAttribute(name);
  if (raw == null) return fallback;
  const m = LENGTH.exec(raw);
  if (!m) {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === '' || unit === 'px') return n;
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
