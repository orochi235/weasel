import { readCssNumber } from './cssNumber';

/** One layer of a CSS `box-shadow`, lengths in px. */
export interface BoxShadow {
  inset: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** As written; `currentColor` when the layer names none. */
  color: string;
}

/** `css` split at each top-level `sep`, ignoring any inside parentheses. */
function splitTop(css: string, sep: RegExp): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && sep.test(ch)) {
      out.push(css.slice(start, i));
      start = i + 1;
    }
  }
  out.push(css.slice(start));
  return out.map((s) => s.trim()).filter((s) => s !== '');
}

/** The index of the `)` closing the `(` at `open`, or -1. */
function closing(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '(') depth++;
    else if (css[i] === ')' && --depth === 0) return i;
  }
  return -1;
}

/**
 * `value` with every `var(--name)` and `var(--name, fallback)` replaced as a browser would: by
 * `tokens[name]`, expanded in turn, or by the fallback when the theme has no such token. A
 * resolved theme can hold references (a theme's bevel names its bevel colors), and a canvas
 * reading one has no cascade to substitute them. Throws on a reference with neither.
 */
export function expandVars(value: string, tokens: Readonly<Record<string, string>>, seen: readonly string[] = []): string {
  let out = '';
  let i = 0;
  for (;;) {
    const at = value.indexOf('var(', i);
    if (at < 0) return out + value.slice(i);
    const end = closing(value, at + 3);
    if (end < 0) throw new Error(`expandVars: unclosed var() in "${value}"`);
    const inner = value.slice(at + 4, end);
    const comma = inner.indexOf(',');
    const name = (comma < 0 ? inner : inner.slice(0, comma)).trim();
    const fallback = comma < 0 ? undefined : inner.slice(comma + 1).trim();
    if (seen.includes(name)) throw new Error(`expandVars: ${name} refers to itself`);
    const own = tokens[name];
    const raw = own ?? fallback;
    if (raw === undefined) throw new Error(`expandVars: ${name} is not in the theme and has no fallback`);
    out += value.slice(i, at) + expandVars(raw, tokens, own === undefined ? seen : [...seen, name]);
    i = end + 1;
  }
}

/** A `box-shadow` value's layers, first (topmost) first; `none` has none. Lengths must be px or a bare 0. */
export function parseBoxShadow(value: string): BoxShadow[] {
  if (value.trim() === 'none') return [];
  return splitTop(value, /,/).map((layer) => {
    let inset = false;
    const lengths: number[] = [];
    const color: string[] = [];
    for (const word of splitTop(layer, /\s/)) {
      if (word === 'inset') { inset = true; continue; }
      const n = readCssNumber(word);
      if (n && (n.unit === 'px' || (n.unit === '' && n.value === 0))) { lengths.push(n.value); continue; }
      if (n) throw new Error(`parseBoxShadow: ${word} is not a px length`);
      color.push(word);
    }
    if (lengths.length < 2 || lengths.length > 4) throw new Error(`parseBoxShadow: cannot read "${layer}"`);
    const [x, y, blur = 0, spread = 0] = lengths as [number, number, number?, number?];
    return { inset, x, y, blur, spread, color: color.length ? color.join(' ') : 'currentColor' };
  });
}
