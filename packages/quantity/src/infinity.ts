import type { Part } from './kind';
import { MINUS_SIGN } from './number';
import type { Display } from './quantity';

interface Word {
  text: string;
  spoken: string;
}

const POSITIVE: Word = { text: '∞', spoken: 'infinity' };
const NEGATIVE: Word = { text: `${MINUS_SIGN}∞`, spoken: 'minus infinity' };
const SPELLINGS = ['∞', 'inf', 'infinity', 'infinite'];

function word(w: string | { text: string; spoken?: string }): Word {
  return typeof w === 'string' ? { text: w, spoken: w } : { text: w.text, spoken: w.spoken ?? w.text };
}

/** The word `display` uses for `+Infinity` (`sign` 1) or `−Infinity` (`sign` −1). */
export function infinityWord(display: Display | undefined, sign: 1 | -1): Word {
  const w = display?.infinity;
  if (w === undefined) return sign > 0 ? POSITIVE : NEGATIVE;
  if (sign > 0) return word(w);
  return typeof w === 'object' && w.negative !== undefined ? word(w.negative) : NEGATIVE;
}

/** ±Infinity as its one `infinity` part. No unit or symbol rides along: a word
 *  like `never` stands alone, which is how a control knows to drop a suffix. */
export function infinityParts(value: number, display: Display | undefined): Part[] {
  return [{ type: 'infinity', value: infinityWord(display, value > 0 ? 1 : -1).text }];
}

/** Typed text as ±Infinity when it names it — the display's own words, `∞`,
 *  `inf`, `infinity` or `infinite`, signed or not — else `undefined`. */
export function readInfinity(text: string, display: Display | undefined, locale: string): number | undefined {
  const typed = text.trim().toLocaleLowerCase(locale);
  const is = (w: Word) => w.text.toLocaleLowerCase(locale) === typed || w.spoken.toLocaleLowerCase(locale) === typed;
  if (is(infinityWord(display, 1))) return Infinity;
  if (is(infinityWord(display, -1))) return -Infinity;
  const m = /^([+\-−]?)\s*(.*)$/.exec(typed)!;
  if (!SPELLINGS.includes(m[2]!)) return undefined;
  return m[1] === '-' || m[1] === MINUS_SIGN ? -Infinity : Infinity;
}
