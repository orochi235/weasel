/**
 * Media Queries 4 evaluation against a fixed environment.
 *
 * A parse represents one static render, so `@media` and `<style media>` are
 * answered once, against an {@link SvgMediaEnvironment}, rather than tracked
 * as live conditions.
 */

import { ConditionSyntaxError, evaluateCondition, triAnd, triNot, type Tri } from './condition';
import { splitTopLevel } from './cssScan';

/** The media a parse is taken to be rendered on. */
export interface SvgMediaEnvironment {
  /** Media type; `all` always matches as well. */
  readonly type: string;
  /** Viewport width in CSS px. */
  readonly width: number;
  /** Viewport height in CSS px. */
  readonly height: number;
  /** Device pixels per CSS px. */
  readonly resolution: number;
  readonly prefersColorScheme: 'light' | 'dark';
  readonly prefersReducedMotion: 'no-preference' | 'reduce';
  /** Answers both `hover` and `any-hover`. */
  readonly hover: 'none' | 'hover';
  /** Answers both `pointer` and `any-pointer`. */
  readonly pointer: 'none' | 'coarse' | 'fine';
  /** How often the output can change once rendered. */
  readonly update: 'none' | 'slow' | 'fast';
  /** Bits per color component; 0 on a monochrome device. */
  readonly color: number;
  /** Bits per pixel of a monochrome device; 0 otherwise. */
  readonly monochrome: number;
}

/** A static, light-scheme screen render with no pointer. Width and height are the replaced-element default. */
export const DEFAULT_MEDIA_ENVIRONMENT: SvgMediaEnvironment = {
  type: 'screen',
  width: 300,
  height: 150,
  resolution: 1,
  prefersColorScheme: 'light',
  prefersReducedMotion: 'no-preference',
  hover: 'none',
  pointer: 'none',
  update: 'none',
  color: 8,
  monochrome: 0,
};

const ABSOLUTE_PX: Readonly<Record<string, number>> = {
  px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, q: 96 / 101.6, pt: 96 / 72, pc: 16,
};

/** An absolute SVG length in px, or undefined for a percentage, a relative unit, or garbage. */
function absoluteLength(raw: string | null): number | undefined {
  const m = raw == null ? null : /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)\s*$/i.exec(raw);
  if (!m) return undefined;
  const scale = ABSOLUTE_PX[m[2].toLowerCase() || 'px'];
  const n = parseFloat(m[1]) * (scale ?? NaN);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * The environment a parse of this `<svg>` evaluates media against: the
 * defaults, with the viewport taken from the root's `width` / `height`, then
 * its `viewBox` (keeping its aspect ratio when only one side is given), then
 * the 300 × 150 replaced-element default. `overrides` win over all of it.
 */
export function mediaEnvironmentFor(
  root: Element,
  overrides: Partial<SvgMediaEnvironment> = {},
): SvgMediaEnvironment {
  let width = absoluteLength(root.getAttribute('width'));
  let height = absoluteLength(root.getAttribute('height'));
  const vb = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
    const [, , w, h] = vb;
    if (width == null && height == null) { width = w; height = h; }
    else if (width == null) width = (height as number) * (w / h);
    else if (height == null) height = width * (h / w);
  }
  return {
    ...DEFAULT_MEDIA_ENVIRONMENT,
    width: width ?? DEFAULT_MEDIA_ENVIRONMENT.width,
    height: height ?? DEFAULT_MEDIA_ENVIRONMENT.height,
    ...overrides,
  };
}

type Tok =
  | { readonly k: 'ident'; readonly v: string }
  | { readonly k: 'num'; readonly v: number; readonly unit: string }
  | { readonly k: 'op'; readonly v: '<' | '<=' | '>' | '>=' | '=' }
  | { readonly k: ':' }
  | { readonly k: '/' };

const TOKEN = /\s*(?:([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)|(-?[a-z_][\w-]*)|(<=|>=|<|>|=)|(:)|(\/))/iy;

function tokenize(s: string): Tok[] | null {
  const out: Tok[] = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < s.length) {
    if (/^\s*$/.test(s.slice(TOKEN.lastIndex))) break;
    const m = TOKEN.exec(s);
    if (!m) return null;
    if (m[1] != null) out.push({ k: 'num', v: parseFloat(m[1]), unit: m[2].toLowerCase() });
    else if (m[3] != null) out.push({ k: 'ident', v: m[3].toLowerCase() });
    else if (m[4] != null) out.push({ k: 'op', v: m[4] as '<' | '<=' | '>' | '>=' | '=' });
    else if (m[5] != null) out.push({ k: ':' });
    else out.push({ k: '/' });
  }
  return out;
}

type RangeType = 'length' | 'ratio' | 'resolution' | 'integer';
type Feature =
  | { readonly kind: 'range'; readonly type: RangeType; readonly get: (e: SvgMediaEnvironment) => number }
  | {
    readonly kind: 'discrete';
    readonly values: readonly string[];
    /** The value that is false in a boolean context, if any. */
    readonly off?: string;
    readonly get: (e: SvgMediaEnvironment) => string;
  };

const width = (e: SvgMediaEnvironment): number => e.width;
const height = (e: SvgMediaEnvironment): number => e.height;
const aspect = (e: SvgMediaEnvironment): number => e.width / e.height;
const hover: Feature = { kind: 'discrete', values: ['none', 'hover'], off: 'none', get: (e) => e.hover };
const pointer: Feature = { kind: 'discrete', values: ['none', 'coarse', 'fine'], off: 'none', get: (e) => e.pointer };

const FEATURES: Readonly<Record<string, Feature>> = {
  'width': { kind: 'range', type: 'length', get: width },
  'height': { kind: 'range', type: 'length', get: height },
  'device-width': { kind: 'range', type: 'length', get: width },
  'device-height': { kind: 'range', type: 'length', get: height },
  'aspect-ratio': { kind: 'range', type: 'ratio', get: aspect },
  'device-aspect-ratio': { kind: 'range', type: 'ratio', get: aspect },
  'resolution': { kind: 'range', type: 'resolution', get: (e) => e.resolution },
  'color': { kind: 'range', type: 'integer', get: (e) => e.color },
  'monochrome': { kind: 'range', type: 'integer', get: (e) => e.monochrome },
  'orientation': {
    kind: 'discrete', values: ['portrait', 'landscape'],
    get: (e) => (e.height >= e.width ? 'portrait' : 'landscape'),
  },
  'prefers-color-scheme': { kind: 'discrete', values: ['light', 'dark'], get: (e) => e.prefersColorScheme },
  'prefers-reduced-motion': {
    kind: 'discrete', values: ['no-preference', 'reduce'], off: 'no-preference', get: (e) => e.prefersReducedMotion,
  },
  'update': { kind: 'discrete', values: ['none', 'slow', 'fast'], off: 'none', get: (e) => e.update },
  'hover': hover,
  'any-hover': hover,
  'pointer': pointer,
  'any-pointer': pointer,
};

const FONT_PX = 16;

function lengthPx(v: number, unit: string, env: SvgMediaEnvironment): number | null {
  if (unit === '') return v === 0 ? 0 : null;
  const abs = ABSOLUTE_PX[unit];
  if (abs != null) return v * abs;
  switch (unit) {
    case 'em': case 'rem': return v * FONT_PX;
    case 'ex': case 'ch': return v * FONT_PX / 2;
    case 'vw': return v * env.width / 100;
    case 'vh': return v * env.height / 100;
    case 'vmin': return v * Math.min(env.width, env.height) / 100;
    case 'vmax': return v * Math.max(env.width, env.height) / 100;
    default: return null;
  }
}

const DPPX: Readonly<Record<string, number>> = { dppx: 1, x: 1, dpi: 1 / 96, dpcm: 2.54 / 96 };

/** A range feature's value written as `toks`, in the feature's canonical unit. */
function rangeValue(toks: readonly Tok[], type: RangeType, env: SvgMediaEnvironment): number | null {
  const [a, b, c] = toks;
  if (type === 'ratio') {
    if (toks.length === 1 && a.k === 'num' && a.unit === '' && a.v >= 0) return a.v;
    if (toks.length === 3 && a.k === 'num' && b.k === '/' && c.k === 'num' && a.unit === '' && c.unit === '' &&
      a.v >= 0 && c.v > 0) return a.v / c.v;
    return null;
  }
  if (toks.length !== 1 || a.k !== 'num') return null;
  if (type === 'length') return lengthPx(a.v, a.unit, env);
  if (type === 'resolution') return DPPX[a.unit] != null ? a.v * DPPX[a.unit] : null;
  return a.unit === '' && Number.isInteger(a.v) ? a.v : null;
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function compare(a: number, op: string, b: number): boolean {
  switch (op) {
    case '=': return close(a, b);
    case '<': return a < b && !close(a, b);
    case '<=': return a < b || close(a, b);
    case '>': return a > b && !close(a, b);
    default: return a > b || close(a, b);
  }
}

const FLIP: Readonly<Record<string, string>> = { '<': '>', '<=': '>=', '>': '<', '>=': '<=', '=': '=' };

/** One `( … )` feature test. Anything that does not parse as a known feature is unknown. */
function evaluateFeature(inner: string, env: SvgMediaEnvironment): Tri {
  const toks = tokenize(inner);
  if (!toks || toks.length === 0) return null;
  const first = toks[0];

  if (toks.length === 1) {
    if (first.k !== 'ident') return null;
    const f = FEATURES[first.v];
    if (!f) return null;
    return f.kind === 'range' ? f.get(env) !== 0 : f.get(env) !== f.off;
  }

  if (first.k === 'ident' && toks[1].k === ':') {
    const prefix = /^(min|max)-/.exec(first.v)?.[1];
    const f = FEATURES[prefix ? first.v.slice(4) : first.v];
    if (!f) return null;
    const rest = toks.slice(2);
    if (f.kind === 'discrete') {
      if (prefix || rest.length !== 1 || rest[0].k !== 'ident' || !f.values.includes(rest[0].v)) return null;
      return f.get(env) === rest[0].v;
    }
    const v = rangeValue(rest, f.type, env);
    if (v == null) return null;
    return compare(f.get(env), prefix === 'min' ? '>=' : prefix === 'max' ? '<=' : '=', v);
  }

  // Level-4 range syntax: `name op v`, `v op name`, or `v1 op name op v2`.
  const segments: Tok[][] = [[]];
  const ops: string[] = [];
  for (const t of toks) {
    if (t.k === 'op') { ops.push(t.v); segments.push([]); }
    else segments[segments.length - 1].push(t);
  }
  if (segments.some((s) => s.length === 0)) return null;
  const featureAt = (s: Tok[]): Feature | undefined =>
    (s.length === 1 && s[0].k === 'ident' ? FEATURES[s[0].v] : undefined);

  if (ops.length === 1) {
    const [lhs, rhs] = segments;
    const named = featureAt(lhs) ?? featureAt(rhs);
    if (!named) return null;
    if (named.kind !== 'range') return null;
    const nameFirst = featureAt(lhs) != null;
    const v = rangeValue(nameFirst ? rhs : lhs, named.type, env);
    if (v == null) return null;
    return nameFirst ? compare(named.get(env), ops[0], v) : compare(named.get(env), FLIP[ops[0]], v);
  }
  if (ops.length === 2) {
    const f = featureAt(segments[1]);
    if (!f || f.kind !== 'range') return null;
    const lt = ops.every((o) => o === '<' || o === '<=');
    const gt = ops.every((o) => o === '>' || o === '>=');
    if (!lt && !gt) return null;
    const lo = rangeValue(segments[0], f.type, env);
    const hi = rangeValue(segments[2], f.type, env);
    if (lo == null || hi == null) return null;
    const x = f.get(env);
    return compare(lo, ops[0], x) && compare(x, ops[1], hi);
  }
  return null;
}

const RESERVED_TYPES = new Set(['not', 'and', 'or', 'only', 'layer']);
const TYPED_QUERY = /^(?:(not|only)\s+)?(-?[a-z_][\w-]*)(?:\s+and\s+([\s\S]+))?$/;

function evaluateQuery(query: string, env: SvgMediaEnvironment): Tri {
  const leaves = {
    paren: (inner: string): Tri => evaluateFeature(inner, env),
    fn: (): Tri => null,
  };
  if (/^(?:\(|not\s+\(|-?[a-z_][\w-]*\()/.test(query)) return evaluateCondition(query, leaves);
  const m = TYPED_QUERY.exec(query);
  if (!m || RESERVED_TYPES.has(m[2])) throw new ConditionSyntaxError(`invalid media query "${query}"`);
  const typed = triAnd(m[2] === 'all' || m[2] === env.type, m[3] ? evaluateCondition(m[3], leaves, false) : true);
  return m[1] === 'not' ? triNot(typed) : typed;
}

/**
 * Whether a media query list matches `env`. An empty list matches; a
 * malformed query in the list is `not all`, leaving its neighbors intact; an
 * unknown feature or value is unknown, which never matches, even under `not`.
 */
export function evaluateMediaQuery(list: string, env: SvgMediaEnvironment): boolean {
  const src = list.trim().toLowerCase();
  if (src === '') return true;
  return splitTopLevel(src, ',').some((raw) => {
    const query = raw.trim();
    if (query === '') return false;
    try {
      return evaluateQuery(query, env) === true;
    } catch (e) {
      if (e instanceof ConditionSyntaxError) return false;
      throw e;
    }
  });
}
