/**
 * The presentation properties this parser reads through the cascade, whether
 * each inherits, and which values it honors. `@supports` answers from this
 * table, so a property or value belongs here only when some reader in
 * `parse.ts` or `gradients.ts` acts on it — not when CSS merely allows it.
 */

import { parsePaintAttr } from './color';

interface PropertyDef {
  /** Folded into the inherited `StyleContext` rather than read off the element. */
  readonly inherits: boolean;
  /** Whether the parser does what the value asks (keywords are case-sensitive, as the readers compare them). */
  readonly honors: (value: string) => boolean;
}

/** `text-transform` keywords the runs model carries. */
export const TEXT_TRANSFORMS: ReadonlySet<string> = new Set(['none', 'uppercase', 'lowercase', 'capitalize']);

const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
const isNumber = (v: string): boolean => NUMBER.test(v);
const withUnit = (v: string, units: readonly string[]): boolean => {
  if (isNumber(v)) return true;
  const unit = units.find((u) => v.toLowerCase().endsWith(u));
  return unit != null && isNumber(v.slice(0, -unit.length));
};
const oneOf = (...words: string[]) => (v: string): boolean => words.includes(v);
const isCurrentColor = (v: string): boolean => v.toLowerCase() === 'currentcolor';
const isPaint = (v: string): boolean => isCurrentColor(v) || parsePaintAttr(v) != null;
const isSolidColor = (v: string): boolean => !isCurrentColor(v) && parsePaintAttr(v)?.kind === 'solid';
const isMarkerRef = (v: string): boolean => v === 'none' || /^url\(\s*#[^)\s]+\s*\)$/.test(v);
const isFontWeight = (v: string): boolean =>
  v === 'normal' || v === 'bold' || v === 'bolder' || (isNumber(v) && Number(v) >= 1 && Number(v) <= 1000);
const isDashArray = (v: string): boolean => {
  if (v === 'none') return true;
  const tokens = v.split(/[\s,]+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => withUnit(t, ['px']) && parseFloat(t) >= 0);
};
const isDecoration = (v: string): boolean => {
  const tokens = v.split(/\s+/);
  return tokens.every((t) => t === 'none' || t === 'underline' || t === 'line-through' || t === 'overline');
};

const inherited = (honors: PropertyDef['honors']): PropertyDef => ({ inherits: true, honors });
const own = (honors: PropertyDef['honors']): PropertyDef => ({ inherits: false, honors });

export const PROPERTIES: Readonly<Record<string, PropertyDef>> = {
  'fill': inherited(isPaint),
  'fill-opacity': inherited(isNumber),
  'fill-rule': inherited(oneOf('nonzero', 'evenodd')),
  'stroke': inherited(isPaint),
  'stroke-width': inherited((v) => withUnit(v, ['px'])),
  'stroke-opacity': inherited(isNumber),
  'stroke-linecap': inherited(oneOf('butt', 'round', 'square')),
  'stroke-linejoin': inherited(oneOf('miter', 'round', 'bevel')),
  'stroke-dasharray': inherited(isDashArray),
  'stroke-miterlimit': inherited((v) => isNumber(v) && Number(v) >= 1),
  'marker-start': inherited(isMarkerRef),
  'marker-mid': inherited(isMarkerRef),
  'marker-end': inherited(isMarkerRef),
  'color': inherited((v) => isCurrentColor(v) || isSolidColor(v)),
  'font-size': inherited((v) => withUnit(v, ['px'])),
  'font-family': inherited((v) => v.length > 0),
  'font-weight': inherited(isFontWeight),
  'font-style': inherited(oneOf('normal', 'italic')),
  'text-anchor': inherited(oneOf('start', 'middle', 'end')),
  'letter-spacing': inherited((v) => v === 'normal' || withUnit(v, ['px'])),
  'text-decoration': inherited(isDecoration),
  'direction': inherited(oneOf('ltr', 'rtl')),
  'text-transform': inherited((v) => TEXT_TRANSFORMS.has(v)),
  'opacity': own(isNumber),
  'stop-color': own(isSolidColor),
  'stop-opacity': own((v) => withUnit(v, ['%'])),
  'baseline-shift': own((v) => v === 'super' || v === 'sub' || v === 'baseline' || withUnit(v, ['em', '%'])),
  'vector-effect': own(oneOf('none', 'non-scaling-stroke')),
};

/**
 * Whether a declaration of `prop: value` would change what this parser
 * produces. `inherit` is honored for inherited properties only, since only
 * the inheritance fold reads it.
 */
export function isDeclarationHonored(prop: string, value: string): boolean {
  const def = PROPERTIES[prop.toLowerCase()];
  if (!def) return false;
  const v = value.trim();
  if (v === 'inherit') return def.inherits;
  return def.honors(v);
}
