/**
 * The presentation properties this parser reads through the cascade: whether
 * each inherits, and the one reader that turns its value into what the parser
 * produces. The parser reads every property through {@link readProperty}, and
 * `@supports` answers from the same readers ({@link isDeclarationHonored}), so
 * "is this value honored" and "what is done with it" cannot disagree.
 *
 * A reader returns `undefined` for a value it cannot read, and calls `warn`
 * when it reads one only approximately — a unit it does not convert, a keyword
 * it substitutes. A value is honored when it is read and nothing is warned.
 */

import type { FontVariantCaps, TextTransform } from '@weasel-js/core';
import { parsePaintAttr, type ParsedColor } from './color';

export type Warn = (message: string) => void;

interface PropertyDef<T> {
  /** Folded into the inherited `StyleContext` rather than read off the element. */
  readonly inherits: boolean;
  /** `value` arrives trimmed and never `inherit`. Keywords compare case-sensitively unless a reader folds case. */
  readonly read: (value: string, warn: Warn, prop: string) => T | undefined;
}

/** `text-transform` keywords the runs model carries. */
const TEXT_TRANSFORMS: ReadonlySet<string> = new Set(['none', 'uppercase', 'lowercase', 'capitalize']);

const DIMENSION = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)$/i;

function dimension(v: string): { n: number; unit: string } | undefined {
  const m = DIMENSION.exec(v);
  return m ? { n: Number(m[1]), unit: m[2].toLowerCase() } : undefined;
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/** A bare number, or a length in one of `native` units; any other unit is read as its number and flagged. */
const length = (native: readonly string[], coercedAs: string) =>
  (v: string, warn: Warn, prop: string): number | undefined => {
    const d = dimension(v);
    if (!d) return undefined;
    if (d.unit && !native.includes(d.unit)) {
      warn(`${prop} "${v}" uses unit "${d.unit}", which is not converted; treated as ${d.n} ${coercedAs}`);
    }
    return d.n;
  };

const worldLength = length(['px'], 'world units');

const keyword = <W extends string>(...words: W[]) => (v: string): W | undefined =>
  (words as string[]).includes(v) ? (v as W) : undefined;

const isCurrentColor = (v: string): boolean => v.toLowerCase() === 'currentcolor';

/** A paint as written: `currentColor` has been resolved by the caller, `context-*` has not. */
export type PaintValue = ParsedColor | { kind: 'context'; of: 'fill' | 'stroke' };

function readPaint(v: string): PaintValue | undefined {
  if (v === 'context-fill') return { kind: 'context', of: 'fill' };
  if (v === 'context-stroke') return { kind: 'context', of: 'stroke' };
  return parsePaintAttr(v) ?? undefined;
}

/** `0..1` from a number or a percentage, clamped. */
function readRatio(v: string): number | undefined {
  const d = dimension(v);
  if (!d || (d.unit !== '' && d.unit !== '%')) return undefined;
  return clamp01(d.unit === '%' ? d.n / 100 : d.n);
}

function readSolidColor(v: string, warn: Warn, prop: string): { color: string; alpha: number } | undefined {
  const parsed = parsePaintAttr(v);
  if (parsed?.kind !== 'solid') return undefined;
  if (isCurrentColor(v)) warn(`${prop}="${v}" is read as black; it is not resolved against color`);
  return parsed;
}

/** `null` is `none`. */
function readMarkerRef(v: string): string | null | undefined {
  if (v === 'none') return null;
  return /^url\(\s*#([^)\s]+)\s*\)$/.exec(v)?.[1];
}

function readLinecap(v: string, warn: Warn): 'butt' | 'round' | 'square' | undefined {
  const cap = keyword('butt', 'round', 'square')(v);
  if (!cap) warn(`unsupported stroke-linecap: ${v}`);
  return cap;
}

function readLinejoin(v: string, warn: Warn): 'miter' | 'round' | 'bevel' | undefined {
  const join = keyword('miter', 'round', 'bevel')(v);
  if (join) return join;
  if (v === 'arcs' || v === 'miter-clip') {
    warn(`stroke-linejoin "${v}" not supported; falling back to miter`);
    return 'miter';
  }
  warn(`unsupported stroke-linejoin: ${v}`);
  return undefined;
}

/** `null` is `none`; an odd-length list is repeated to make the pattern even, as SVG says. */
function readDashArray(v: string, warn: Warn): number[] | null | undefined {
  if (v === 'none' || v === '') return null;
  const nums: number[] = [];
  for (const t of v.split(/[\s,]+/).filter(Boolean)) {
    const d = dimension(t);
    if (!d || (d.unit !== '' && d.unit !== 'px') || d.n < 0) {
      warn(`unrecognized stroke-dasharray: ${v}`);
      return undefined;
    }
    nums.push(d.n);
  }
  return nums.length % 2 === 1 ? [...nums, ...nums] : nums;
}

function readMiterLimit(v: string, warn: Warn): number | undefined {
  const d = dimension(v);
  if (d && d.unit === '' && d.n >= 1) return d.n;
  warn(`unrecognized stroke-miterlimit: ${v}`);
  return undefined;
}

/** The raw value, once it is known to be a color or `currentColor`. */
function readColor(v: string): string | undefined {
  return isCurrentColor(v) || parsePaintAttr(v)?.kind === 'solid' ? v : undefined;
}

/** A percentage is relative to the parent's size (`fontScale`); anything else is an absolute `fontSize`. */
function readFontSize(v: string, warn: Warn, prop: string): { fontSize?: number; fontScale?: number } | undefined {
  const d = dimension(v);
  if (d?.unit === '%') return { fontScale: d.n / 100 };
  const n = worldLength(v, warn, prop);
  return n == null ? undefined : { fontSize: n };
}

function readFontWeight(v: string): 'normal' | 'bold' | 'bolder' | number | undefined {
  if (v === 'normal' || v === 'bold' || v === 'bolder') return v;
  const d = dimension(v);
  return d && d.unit === '' && d.n >= 1 && d.n <= 1000 ? d.n : undefined;
}

function readFontStyle(v: string, warn: Warn): 'normal' | 'italic' | undefined {
  if (v === 'normal' || v === 'italic') return v;
  if (v === 'oblique') {
    warn('font-style "oblique" is read as italic');
    return 'italic';
  }
  return undefined;
}

/** `null` is `normal`. */
function readLetterSpacing(v: string, warn: Warn, prop: string): number | null | undefined {
  return v === 'normal' ? null : worldLength(v, warn, prop);
}

export interface Decoration { underline?: boolean; strikethrough?: boolean; overline?: boolean }

function readDecoration(v: string, warn: Warn): Decoration {
  const out: Decoration = {};
  for (const t of v.toLowerCase().split(/\s+/)) {
    if (t === 'underline') out.underline = true;
    else if (t === 'line-through') out.strikethrough = true;
    else if (t === 'overline') out.overline = true;
    // CSS lets a renderer decline to blink, so dropping it honors it.
    else if (t !== 'none' && t !== 'blink') warn(`text-decoration "${v}": "${t}" is not modeled; dropped`);
  }
  return out;
}

/** `small-caps` or `normal`, out of what may be a CSS 3 shorthand; any other
 *  variant is one the run model does not carry. */
function readFontVariant(v: string, warn: Warn): FontVariantCaps | undefined {
  let out: FontVariantCaps | undefined;
  for (const t of v.toLowerCase().split(/\s+/)) {
    if (t === 'small-caps' || t === 'normal') out = t;
    else if (t) warn(`font-variant "${v}": "${t}" is not modeled; dropped`);
  }
  return out;
}

function readTextTransform(v: string): TextTransform | undefined {
  const t = v.toLowerCase();
  return TEXT_TRANSFORMS.has(t) ? (t as TextTransform) : undefined;
}

const emLength = length(['em'], 'em');

/**
 * `super` and `sub` are the presets `script` names; a percentage resolves
 * against the parent's font size, the unit `baselineShift` is already in; a
 * bare number is ems; `baseline` or zero is no shift.
 */
function readBaselineShift(
  v: string, warn: Warn, prop: string,
): { script?: 'super' | 'sub'; baselineShift?: number } | undefined {
  const k = v.toLowerCase();
  if (k === 'super' || k === 'sub') return { script: k };
  if (k === 'baseline') return {};
  const d = dimension(v);
  if (d?.unit === '%') return d.n === 0 ? {} : { baselineShift: d.n / 100 };
  const n = emLength(v, warn, prop);
  if (n == null) return undefined;
  return n === 0 ? {} : { baselineShift: n };
}

const inherited = <T>(read: PropertyDef<T>['read']): PropertyDef<T> & { inherits: true } => ({ inherits: true, read });
const own = <T>(read: PropertyDef<T>['read']): PropertyDef<T> & { inherits: false } => ({ inherits: false, read });

export const PROPERTIES = {
  'fill': inherited(readPaint),
  'fill-opacity': inherited(readRatio),
  'fill-rule': inherited(keyword('nonzero', 'evenodd')),
  'stroke': inherited(readPaint),
  'stroke-width': inherited(worldLength),
  'stroke-opacity': inherited(readRatio),
  'stroke-linecap': inherited(readLinecap),
  'stroke-linejoin': inherited(readLinejoin),
  'stroke-dasharray': inherited(readDashArray),
  'stroke-miterlimit': inherited(readMiterLimit),
  'marker-start': inherited(readMarkerRef),
  'marker-mid': inherited(readMarkerRef),
  'marker-end': inherited(readMarkerRef),
  'color': inherited(readColor),
  'font-size': inherited(readFontSize),
  'font-family': inherited((v) => (v.length > 0 ? v : undefined)),
  'font-weight': inherited(readFontWeight),
  'font-style': inherited(readFontStyle),
  'text-anchor': inherited(keyword('start', 'middle', 'end')),
  'letter-spacing': inherited(readLetterSpacing),
  'text-decoration': inherited(readDecoration),
  'direction': inherited(keyword('ltr', 'rtl')),
  'text-transform': inherited(readTextTransform),
  'font-variant': inherited(readFontVariant),
  'opacity': own(readRatio),
  'stop-color': own(readSolidColor),
  'stop-opacity': own(readRatio),
  'baseline-shift': own(readBaselineShift),
  'vector-effect': own(keyword('none', 'non-scaling-stroke')),
} as const satisfies Record<string, PropertyDef<unknown>>;

export type PropertyName = keyof typeof PROPERTIES;
export type InheritedPropertyName = {
  [K in PropertyName]: (typeof PROPERTIES)[K]['inherits'] extends true ? K : never
}[PropertyName];
export type PropertyValue<K extends PropertyName> =
  (typeof PROPERTIES)[K] extends PropertyDef<infer T> ? T : never;

export const INHERITED_PROPERTIES = (Object.keys(PROPERTIES) as PropertyName[])
  .filter((p): p is InheritedPropertyName => PROPERTIES[p].inherits);

const silent: Warn = () => {};

/** Read a raw cascaded value of `prop`; `undefined` when absent or unreadable. */
export function readProperty<K extends PropertyName>(
  prop: K, raw: string | null | undefined, warn: Warn = silent,
): PropertyValue<K> | undefined {
  if (raw == null) return undefined;
  const v = raw.trim();
  if (v === 'inherit') return undefined;
  return PROPERTIES[prop].read(v, warn, prop) as PropertyValue<K> | undefined;
}

function isPropertyName(prop: string): prop is PropertyName {
  return Object.prototype.hasOwnProperty.call(PROPERTIES, prop);
}

/**
 * Whether a declaration of `prop: value` would change what this parser
 * produces, exactly as asked. `inherit` is honored for inherited properties
 * only, since only the inheritance fold reads it.
 */
export function isDeclarationHonored(prop: string, value: string): boolean {
  const name = prop.toLowerCase();
  if (!isPropertyName(name)) return false;
  const v = value.trim();
  if (v === 'inherit') return PROPERTIES[name].inherits;
  let warned = false;
  return readProperty(name, v, () => { warned = true; }) !== undefined && !warned;
}
