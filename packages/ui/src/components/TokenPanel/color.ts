import { parseHexBytes } from '@weasel-js/core';
import { parseColor, rgbaToHex } from '@weasel-js/paint';

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

function hexOf(v: string): string | null {
  try {
    const [r, g, b] = parseColor(v);
    return rgbaToHex([r, g, b]);
  } catch {
    return null;
  }
}

let paint: CanvasRenderingContext2D | null | undefined;

/** The browser's serialization of a color, through a canvas fill style; null where it has none or rejects `value`. */
function serialized(value: string): string | null {
  if (paint === undefined) {
    try {
      paint = document.createElement('canvas').getContext('2d');
    } catch {
      paint = null;
    }
  }
  if (!paint) return null;
  // A rejected value leaves the previous fill style, so two different ones tell a rejection apart.
  paint.fillStyle = '#000000';
  paint.fillStyle = value;
  const onBlack = String(paint.fillStyle);
  paint.fillStyle = '#ffffff';
  paint.fillStyle = value;
  return onBlack === String(paint.fillStyle) ? onBlack : null;
}

/** `value` as the `#rrggbb` a color input takes, alpha dropped; null when it cannot be converted. */
export function toHex(value: string): string | null {
  const v = value.trim();
  const direct = hexOf(v);
  if (direct) return direct;
  const browser = typeof document === 'undefined' ? null : serialized(v);
  return browser && browser !== v ? hexOf(browser) : null;
}
