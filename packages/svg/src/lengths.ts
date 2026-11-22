/**
 * The one reader for a geometry attribute's length (`x`, `width`, `r`, …).
 *
 * A percentage resolves against the nearest `<svg>` ancestor's viewport, as
 * SVG has it, and an absolute CSS unit (`mm`, `pt`, …) converts at 96 per
 * inch. An `em` or `ex` is of the element's computed font size.
 */

import { absolutePx } from './absoluteUnits';
import { emsPer, fontSizeOf } from './fontSize';
import { styleAt } from './styleAt';
import { parseViewBoxAttr } from './viewBox';

const LENGTH = /^\s*([-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?)\s*([a-z%]*)\s*$/i;

/** Which viewport dimension a percentage is of. `'other'` is a length with no
 *  axis, like a radius: SVG's normalized diagonal, `sqrt((w² + h²) / 2)`. */
export type LengthAxis = 'x' | 'y' | 'other';

/** A side no attribute sizes is `NaN`. */
type Viewport = { readonly width: number; readonly height: number };

function viewportOf(el: Element): Viewport | undefined {
  for (let e = el.parentElement; e; e = e.parentElement) {
    if (e.tagName.toLowerCase() !== 'svg') continue;
    const box = parseViewBoxAttr(e.getAttribute('viewBox'));
    if (box) return { width: box.width, height: box.height };
    if (!hasSvgAbove(e)) return orUndefined(outerViewportOf(e));
    let outer: Viewport | undefined | null = null;
    const around = (): Viewport | undefined => (outer === null ? (outer = viewportOf(e)) : outer);
    return orUndefined({ width: viewportSide(e, 'width', around), height: viewportSide(e, 'height', around) });
  }
  return undefined;
}

const orUndefined = (v: Viewport): Viewport | undefined =>
  (Number.isFinite(v.width) || Number.isFinite(v.height) ? v : undefined);

function hasSvgAbove(el: Element): boolean {
  for (let e = el.parentElement; e; e = e.parentElement) if (e.tagName.toLowerCase() === 'svg') return true;
  return false;
}

/**
 * The outermost `<svg>`'s viewport, which its percentages and its media and
 * container queries all read: its `width` and `height` as lengths, a side left
 * out taken from the `viewBox`'s aspect ratio, and `NaN` for a side neither gives.
 * A percentage or `auto` gives none, with nothing outside the document to be of.
 * `fontSize` is the root's, for an `em` side; without it, read from its computed style.
 */
export function outerViewportOf(root: Element, fontSize?: number): Viewport {
  let width = outerSide(root, 'width', fontSize);
  let height = outerSide(root, 'height', fontSize);
  const vb = parseViewBoxAttr(root.getAttribute('viewBox'));
  if (vb && vb.width > 0 && vb.height > 0) {
    if (Number.isNaN(width) && Number.isNaN(height)) ({ width, height } = vb);
    else if (Number.isNaN(width)) width = height * (vb.width / vb.height);
    else if (Number.isNaN(height)) height = width * (vb.height / vb.width);
  }
  return { width, height };
}

const SIDE = /^[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?\s*[a-z]*$/i;

function outerSide(root: Element, name: 'width' | 'height', fontSize?: number): number {
  const raw = root.getAttribute(name)?.trim();
  if (raw == null || !SIDE.test(raw)) return NaN;
  const n = lengthOf(raw, root, name, name === 'width' ? 'x' : 'y', () => {}, fontSize);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}

/** An `<svg>`'s `width` or `height`: absent or `auto` is `100%`, and a percentage
 *  is of the viewport it sits in; `NaN` where there is none. */
function viewportSide(svg: Element, name: 'width' | 'height', around: () => Viewport | undefined): number {
  const own = svg.getAttribute(name);
  const raw = own == null || own.trim().toLowerCase() === 'auto' ? '100%' : own;
  const m = LENGTH.exec(raw);
  if (m?.[2] !== '%') return resolveLength(raw, svg, name, name === 'width' ? 'x' : 'y', NaN, () => {});
  const outer = around();
  return outer ? (Number(m[1]) / 100) * outer[name] : NaN;
}

/** `fontSize` is `el`'s computed font size where the caller has the cascade it
 *  draws under, which a `<use>`'s target takes from the `<use>`, not from its
 *  own ancestors; without it the size is read from `el`'s place in the document. */
export function readLength(
  el: Element,
  name: string,
  axis: LengthAxis,
  fallback: number,
  onWarn: (m: string) => void,
  fontSize?: number,
): number {
  return resolveLength(el.getAttribute(name), el, name, axis, fallback, onWarn, fontSize);
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
  fontSize?: number,
): number {
  if (raw == null) return fallback;
  const n = lengthOf(raw, el, name, axis, onWarn, fontSize);
  return Number.isFinite(n) ? n : fallback;
}

function lengthOf(
  raw: string, el: Element, name: string, axis: LengthAxis, onWarn: (m: string) => void, fontSize?: number,
): number {
  const m = LENGTH.exec(raw);
  if (!m) return parseFloat(raw);
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (unit === '') return n;
  const scale = absolutePx(unit);
  if (scale != null) return n * scale;
  const ems = emsPer(unit);
  if (ems != null) return n * ems * (fontSize ?? fontSizeOf(styleAt(el)));
  const tag = el.tagName.toLowerCase();
  if (unit !== '%') {
    onWarn(`<${tag} ${name}="${raw}"> unit "${unit}" is not converted; read as ${n}`);
    return n;
  }
  const view = viewportOf(el);
  const of = !view ? NaN : axis === 'x' ? view.width
    : axis === 'y' ? view.height
      : Math.sqrt((view.width * view.width + view.height * view.height) / 2);
  if (!Number.isFinite(of)) {
    onWarn(`<${tag} ${name}="${raw}"> has no viewport to be a percentage of; read as ${n}`);
    return n;
  }
  return (n / 100) * of;
}
