/**
 * The values a SMIL animation moves through, read for the attribute it animates: numbers, number
 * lists, colors as RGBA in 0..1, path data, and strings that only step.
 */
import { tryParseColor } from '@weasel-js/paint';

/** A value a SMIL animation takes, as a clip key holds it. */
export type SmilValue = number | number[] | string;

/** How an attribute's values are read and whether they interpolate. */
export type SmilKind = 'number' | 'list' | 'color' | 'path' | 'string';

const NUMBERS = new Set([
  'opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity', 'flood-opacity', 'stroke-width', 'stroke-dashoffset',
  'stroke-miterlimit', 'r', 'rx', 'ry', 'cx', 'cy', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'font-size',
  'offset', 'pathLength', 'stdDeviation',
]);
const COLORS = new Set(['fill', 'stroke', 'stop-color', 'color', 'flood-color', 'lighting-color']);
const LISTS = new Set(['stroke-dasharray', 'points', 'viewBox']);

export function smilKind(attribute: string): SmilKind {
  if (NUMBERS.has(attribute)) return 'number';
  if (COLORS.has(attribute)) return 'color';
  if (LISTS.has(attribute)) return 'list';
  return attribute === 'd' ? 'path' : 'string';
}

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function number(raw: string): number | null {
  const s = raw.trim().replace(/px$/i, '');
  return NUMBER.test(s) ? Number(s) : null;
}

/** One value as `kind` reads it, or null where it cannot: a length in a unit other than px, a
 *  paint that is no color (`none`, a gradient), a list with a non-number in it. */
export function smilValue(kind: SmilKind, raw: string): SmilValue | null {
  switch (kind) {
    case 'number': return number(raw);
    case 'list': {
      const parts = raw.trim().split(/[\s,]+/).filter(Boolean).map(number);
      return parts.length > 0 && parts.every((n) => n !== null) ? (parts as number[]) : null;
    }
    case 'color': {
      if (/^\s*currentcolor\s*$/i.test(raw)) return null;
      const rgba = tryParseColor(raw.trim());
      return rgba ? [...rgba] : null;
    }
    default: return raw.trim();
  }
}

/** A value plus `by`, for a `by` animation: numbers and lists of one length add. */
export function addValues(a: SmilValue, b: SmilValue): SmilValue | null {
  if (typeof a === 'number' && typeof b === 'number') return a + b;
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.map((v, i) => v + b[i]);
  return null;
}

/** How far apart two values are, for `calcMode="paced"`: null where they have no distance. */
export function distance(a: SmilValue, b: SmilValue): number | null {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(b - a);
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return Math.hypot(...a.map((v, i) => b[i] - v));
  return null;
}

/** Whether every value has the shape of the first, so a track can lerp them. */
export function sameShape(values: readonly SmilValue[]): boolean {
  const [first] = values;
  return values.every((v) => typeof v === typeof first && (!Array.isArray(v) || v.length === (first as number[]).length));
}

/** `<animateTransform>` values as numbers, filled out to the type's arity with SVG's defaults:
 *  `translate` [tx, ty], `scale` [sx, sy], `rotate` [angle, cx, cy], `skewX`/`skewY` [angle]. */
export function transformValue(type: string, raw: string): number[] | null {
  const parts = raw.trim().split(/[\s,]+/).filter(Boolean).map(number);
  if (parts.length === 0 || parts.some((n) => n === null)) return null;
  const n = parts as number[];
  switch (type) {
    case 'translate': return n.length <= 2 ? [n[0], n[1] ?? 0] : null;
    case 'scale': return n.length <= 2 ? [n[0], n[1] ?? n[0]] : null;
    case 'rotate': return n.length === 1 || n.length === 3 ? [n[0], n[1] ?? 0, n[2] ?? 0] : null;
    case 'skewX': case 'skewY': return n.length === 1 ? n : null;
    default: return null;
  }
}
