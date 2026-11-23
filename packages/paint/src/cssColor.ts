import { isNamedColor, tryParseColor } from './color';
import { parseHexBytes } from './hex';

const COLOR_FUNCTION = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/i;
const KEYWORDS = new Set(['transparent', 'currentcolor']);

const CSS_WIDE = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);

function browserSupports(): ((value: string) => boolean) | null {
  // Read off globalThis: naming `CSS` would make paint need lib.dom.
  const css = (globalThis as { CSS?: { supports?: (property: string, value: string) => boolean } }).CSS;
  const supports = css?.supports;
  return typeof supports === 'function' ? (value) => supports.call(css, 'color', value) : null;
}

/** Whether `value` is a CSS color — the browser's answer where it has `CSS.supports`, a small parser's otherwise. */
export function parsesAsColor(value: string, supports: ((value: string) => boolean) | null = browserSupports()): boolean {
  const v = value.trim();
  // `CSS.supports` accepts any `var()`, and any CSS-wide keyword, for any property.
  if (!v || v.includes('var(') || CSS_WIDE.has(v.toLowerCase())) return false;
  // jsdom's CSS.supports recurses per nesting level and overflows the stack on long runs of brackets.
  if (!couldBeColor(v)) return false;
  if (supports) return supports(v);
  return parseHexBytes(v) !== null || isColorFunction(v) || KEYWORDS.has(v.toLowerCase()) || isNamedColor(v);
}

/** The functions `parseColor` reads in full, unless they nest one (`calc()`) or take relative syntax (`from`). */
const PARSED_FUNCTION = /^(?:(?:rgba?|hsla?|oklab|oklch)\((?!\s*from\s)|color\(\s*srgb(?:-linear)?\s)[^(]*\)$/i;

/** The most parentheses any color value nests: relative color syntax around `color-mix` reaches four. */
const MAX_COLOR_DEPTH = 16;

/** Whether `v` is shaped like any color can be: no brackets, braces or semicolons, and parentheses nested no
 *  deeper than {@link MAX_COLOR_DEPTH}. */
function couldBeColor(v: string): boolean {
  if (/[[\]{};]/.test(v)) return false;
  let depth = 0;
  for (const c of v) {
    if (c === '(' && ++depth > MAX_COLOR_DEPTH) return false;
    if (c === ')') depth--;
  }
  return true;
}

/** A color function whose own parenthesis closes at the end of `v`, so nothing follows it. One `parseColor` reads
 *  in full is a color only where it parses, so the two never disagree. */
function isColorFunction(v: string): boolean {
  if (PARSED_FUNCTION.test(v)) return tryParseColor(v) !== null;
  const open = COLOR_FUNCTION.exec(v);
  if (!open || /[{};]/.test(v)) return false;
  let depth = 0;
  for (let i = open[0].length - 1; i < v.length; i++) {
    if (v[i] === '(') depth++;
    else if (v[i] === ')' && --depth === 0) return i === v.length - 1 && i > open[0].length;
  }
  return false;
}
