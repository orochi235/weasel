import { parsesAsColor } from './color';

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

export type TokenCategory = 'color' | 'type' | 'size' | 'motion' | 'depth' | 'other';

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

const AMOUNT = String.raw`-?(?:\d+\.?\d*|\.\d+)`;
const DIMENSION = new RegExp(
  `^${AMOUNT}(?:px|rem|em|%|ch|ex|lh|rlh|vh|vw|vmin|vmax|svh|lvh|dvh|cqw|cqh|pt|pc|cm|mm|in|q)$`,
  'i',
);
const DURATION = new RegExp(`^${AMOUNT}m?s$`);
const NUMBER = new RegExp(`^${AMOUNT}$`);
const LENGTH = new RegExp(`^${AMOUNT}(?:px|rem|em)?$`);
const BEZIER = new RegExp(`^cubic-bezier\\(\\s*(${AMOUNT})\\s*,\\s*(${AMOUNT})\\s*,\\s*(${AMOUNT})\\s*,\\s*(${AMOUNT})\\s*\\)$`, 'i');
const GRADIENT = /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;
/** Commas outside parentheses: a shadow's layers, not a color function's arguments. */
const LAYERS = /,(?![^(]*\))/;
const PARTS = /[a-z-]+\([^)]*\)|\S+/gi;

function isShadow(value: string): boolean {
  return value.split(LAYERS).every((layer) => {
    const parts = layer.trim().replace(/^inset\s+/i, '').match(PARTS) ?? [];
    const lengths = parts.filter((part) => LENGTH.test(part));
    const rest = parts.filter((part) => !LENGTH.test(part));
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
