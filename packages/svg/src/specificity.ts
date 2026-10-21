/** CSS Selectors 4 specificity. */

import { parenEnd, skipString, splitTopLevel } from './cssScan';

/** A selector's specificity as (ids, classes, types). */
export type Specificity = readonly [number, number, number];

/** Read an identifier (with escapes) starting at `i`; returns its end index. */
function identEnd(s: string, i: number): number {
  while (i < s.length) {
    const ch = s[i];
    if (ch === '\\') i += 2;
    else if (/[\w-]/.test(ch) || ch.charCodeAt(0) > 0x7f) i++;
    else break;
  }
  return i;
}

const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);
const MAX_ARG_PSEUDOS = new Set(['not', 'is', 'matches', '-webkit-any', 'has']);

/** Negative when `a` is less specific than `b`, positive when more, 0 when equal. */
export function compareSpecificity(a: Specificity, b: Specificity): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

function maxSpecificity(list: string): Specificity {
  let best: Specificity = [0, 0, 0];
  for (const sel of splitTopLevel(list, ',')) {
    const s = specificity(sel);
    if (compareSpecificity(s, best) > 0) best = s;
  }
  return best;
}

/** CSS Selectors 4 specificity of one complex selector (no comma list). */
export function specificity(selector: string): Specificity {
  let a = 0, b = 0, c = 0;
  const s = selector;
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === '#') {
      a++;
      i = identEnd(s, i + 1);
    } else if (ch === '.') {
      b++;
      i = identEnd(s, i + 1);
    } else if (ch === '[') {
      b++;
      while (i < s.length && s[i] !== ']') {
        i = s[i] === '"' || s[i] === "'" ? skipString(s, i) : i + 1;
      }
      i++;
    } else if (ch === ':') {
      const element = s[i + 1] === ':';
      const nameStart = i + (element ? 2 : 1);
      const nameEnd = identEnd(s, nameStart);
      const name = s.slice(nameStart, nameEnd).toLowerCase();
      let arg: string | null = null;
      i = nameEnd;
      if (s[i] === '(') {
        const end = parenEnd(s, i);
        arg = s.slice(i + 1, end - 1);
        i = end;
      }
      if (element || LEGACY_PSEUDO_ELEMENTS.has(name)) c++;
      else if (name === 'where') { /* contributes nothing */ }
      else if (MAX_ARG_PSEUDOS.has(name) && arg != null) {
        const m = maxSpecificity(arg);
        a += m[0]; b += m[1]; c += m[2];
      } else b++;
    } else if (/[a-zA-Z_\\-]/.test(ch) || ch.charCodeAt(0) > 0x7f) {
      c++;
      i = identEnd(s, i);
    } else {
      i++;
    }
  }
  return [a, b, c];
}
