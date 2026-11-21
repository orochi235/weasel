import { parsesAsColor } from '@weasel-js/paint';

/** A design token as `TokenPanel` edits it. */
export interface TokenEntry {
  /** The custom property, e.g. `--wzl-gray-50`. */
  name: string;
  /** A DTCG type name. A type the panel has no control for edits as text. */
  type: string;
  /** Tokens sharing a group sit together; a color group large enough draws as one row of swatches. */
  group: string;
  value: string;
  /** Whether `value` overrides the token's own, which offers Reset. */
  overridden?: boolean;
  description?: string;
}

/** A token's new value, or null to drop its override. */
export type OnTokenChange = (name: string, value: string | null) => void;

/** How the panel's number fields show an amount. */
export const NUMBER_FORMAT = { maximumFractionDigits: 4, useGrouping: false } as const;

/** Whether a number field shows `a` and `b` as the same text. A field commits
 *  what it shows on blur, so an untouched one reports its value rounded. */
export function shownAlike(a: number, b: number): boolean {
  const places = NUMBER_FORMAT.maximumFractionDigits;
  return a.toFixed(places) === b.toFixed(places);
}

/** How a scale's steps follow from its base: one multiplier per step, a constant ratio, or a constant step. */
export type TokenScaleRule =
  | { kind: 'factors'; factors: readonly number[] }
  | { kind: 'ratio'; ratio: number }
  | { kind: 'step'; step: number };

/** A group whose steps are generated from a base, so the panel edits the base and the rule rather than each step. */
export interface TokenScale {
  /** The generated tokens, smallest first. Anything else in the group draws as an ordinary step. */
  tokens: readonly string[];
  base: number;
  rule: TokenScaleRule;
}

/** A fitted multiplier, ratio or step, kept to the places a number field shows, so a refit regenerates the steps it
 *  was fitted to. */
export const roundFit = (n: number) => Number(n.toFixed(NUMBER_FORMAT.maximumFractionDigits));

/**
 * The same scale under another rule, fitted to the amounts its steps have now.
 * A ratio or step counts from the first step, so switching to one moves the
 * base there. Factors need a positive base, so from one that is not they move it to the first positive step.
 */
export function refitScale(scale: TokenScale, kind: TokenScaleRule['kind'], amounts: readonly number[]): TokenScale {
  const first = amounts[0] ?? scale.base;
  const last = amounts.at(-1) ?? first;
  const spans = Math.max(1, amounts.length - 1);
  switch (kind) {
    case 'factors': {
      const base = scale.base > 0 ? scale.base : amounts.find((a) => a > 0);
      if (base === undefined) return { ...scale, rule: { kind, factors: amounts.map(() => 1) } };
      return { ...scale, base, rule: { kind, factors: amounts.map((a) => roundFit(a / base)) } };
    }
    case 'ratio':
      return { ...scale, base: first, rule: { kind, ratio: first > 0 && last > 0 ? roundFit((last / first) ** (1 / spans)) : 1 } };
    case 'step':
      return { ...scale, base: first, rule: { kind, step: roundFit((last - first) / spans) } };
  }
}

/** A section of the token panel; `tokenCategory` files each token under one. */
export type TokenCategory ='color' | 'type' | 'size' | 'motion' | 'depth' | 'other';

/** The panel's sections, in the order it draws them. */
export const TOKEN_CATEGORIES: readonly { id: TokenCategory; title: string }[] = [
  { id: 'color', title: 'Color' },
  { id: 'type', title: 'Type' },
  { id: 'size', title: 'Size' },
  { id: 'motion', title: 'Motion' },
  { id: 'depth', title: 'Depth' },
  { id: 'other', title: 'Other' },
];

const TYPE_SCALE = /^(?:font|tracking|leading|letter|line-height)/;

/** The section a token is filed under: by its type, and for a bare dimension or number by its group. */
export function tokenCategory(token: TokenEntry): TokenCategory {
  switch (token.type) {
    case 'color':
      return 'color';
    case 'fontFamily':
    case 'fontWeight':
      return 'type';
    case 'duration':
    case 'cubicBezier':
      return 'motion';
    case 'shadow':
    case 'gradient':
      return 'depth';
    case 'dimension':
    case 'number':
      if (TYPE_SCALE.test(token.group)) return 'type';
      if (token.type === 'number' && (token.group === 'z' || token.group === 'z-index')) return 'depth';
      return 'size';
    default:
      return 'other';
  }
}

// CSS's <number>: a sign, and an exponent as `${n}` writes one past 1e21 or below 1e-6.
const AMOUNT = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?`;
// CSS's lengths: font-relative ones and their root forms, viewport ones in every size, container ones, and absolute ones.
const DIMENSION = new RegExp(
  `^${AMOUNT}(?:%|r?(?:em|ex|cap|ch|ic|lh)|[sld]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max)|px|pt|pc|cm|mm|in|q)$`,
  'i',
);
const DURATION = new RegExp(`^${AMOUNT}m?s$`, 'i');
const NUMBER = new RegExp(`^${AMOUNT}$`);
const LENGTH = new RegExp(`^${AMOUNT}(?:px|rem|em)?$`);
const BEZIER = new RegExp(`^cubic-bezier\\(\\s*(${AMOUNT})\\s*,\\s*(${AMOUNT})\\s*,\\s*(${AMOUNT})\\s*,\\s*(${AMOUNT})\\s*\\)$`, 'i');
const GRADIENT = /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;
/** `value` split at each character `isSeparator` accepts outside parentheses: a shadow's layers at commas, or a layer's
 *  parts at spaces, not a color function's arguments. A scan, since a regular expression cannot count nesting. */
function splitOutside(value: string, isSeparator: (ch: string) => boolean): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]!;
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0 && isSeparator(ch)) {
      out.push(value.slice(start, i));
      start = i + 1;
    }
  }
  out.push(value.slice(start));
  return out;
}

function isShadow(value: string): boolean {
  return splitOutside(value, (ch) => ch === ',').every((layer) => {
    const parts = splitOutside(layer, (ch) => /\s/.test(ch)).filter(Boolean);
    // `inset` may lead or trail the layer.
    const inset = /^inset$/i;
    const body = inset.test(parts[0] ?? '') ? parts.slice(1) : inset.test(parts.at(-1) ?? '') ? parts.slice(0, -1) : parts;
    const lengths = body.filter((part) => LENGTH.test(part));
    const rest = body.filter((part) => !LENGTH.test(part));
    return lengths.length >= 2 && lengths.length <= 4 && rest.length <= 1 && rest.every((part) => parsesAsColor(part));
  });
}

/** A DTCG type read off the shape of a value, for a token that arrives without one. `'string'` when nothing fits. */
export function inferTokenType(value: string): string {
  const v = value.trim();
  if (!v) return 'string';
  if (DURATION.test(v)) return 'duration';
  if (DIMENSION.test(v)) return 'dimension';
  if (NUMBER.test(v)) return 'number';
  if (BEZIER.test(v)) return 'cubicBezier';
  if (GRADIENT.test(v)) return 'gradient';
  if (parsesAsColor(v)) return 'color';
  if (isShadow(v)) return 'shadow';
  return 'string';
}

/** A number and its unit, or null for a value that is not one. */
export function splitUnit(value: string): { amount: number; unit: string } | null {
  const match = new RegExp(`^(${AMOUNT})([a-z%]*)$`, 'i').exec(value.trim());
  return match ? { amount: Number(match[1]), unit: match[2] ?? '' } : null;
}

/** The four control points of a `cubic-bezier()`, or null for any other easing. */
export function bezierPoints(value: string): readonly [number, number, number, number] | null {
  const match = BEZIER.exec(value.trim());
  if (!match) return null;
  const [x1, y1, x2, y2] = match.slice(1, 5).map(Number) as [number, number, number, number];
  return [x1, y1, x2, y2];
}
