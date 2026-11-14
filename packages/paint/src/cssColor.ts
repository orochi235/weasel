import { parseHexBytes } from './hex';

const COLOR_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(.+\)$/i;
const KEYWORDS = new Set([
  'transparent',
  'currentcolor',
  'black',
  'white',
  'gray',
  'silver',
  'red',
  'orange',
  'yellow',
  'gold',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'navy',
  'purple',
  'magenta',
  'pink',
  'brown',
]);

const CSS_WIDE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

type Supports = ((value: string) => boolean) | null;

function browserSupports(): Supports {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
    ? (value) => CSS.supports('color', value)
    : null;
}

/** Whether `value` is a CSS color — the browser's answer where it has `CSS.supports`, a small parser's otherwise. */
export function parsesAsColor(value: string, supports: Supports = browserSupports()): boolean {
  const v = value.trim();
  // `CSS.supports` accepts any `var()`, and any CSS-wide keyword, for any property.
  if (!v || v.includes('var(') || CSS_WIDE.has(v.toLowerCase())) return false;
  if (supports) return supports(v);
  return parseHexBytes(v) !== null || COLOR_FUNCTION.test(v) || KEYWORDS.has(v.toLowerCase());
}
