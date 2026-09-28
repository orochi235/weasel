import { numberPart, spokenSign, type DisplayKind } from '../kind';
import { parseNumber } from '../number';

/**
 * A whole number in Roman numerals, `XII`. Spoken as the plain number, since a
 * screen reader otherwise spells the letters out. Outside 1–3999, which the
 * numerals cannot write, it shows as a plain number.
 */
export type RomanDisplay = {
  kind: 'roman';
  lower?: boolean;
};

/** A {@link RomanDisplay}. */
export function roman(options: Omit<RomanDisplay, 'kind'> = {}): RomanDisplay {
  return { kind: 'roman', ...options };
}

const NUMERALS: readonly [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'],
  [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

/** `n` in Roman numerals, or undefined outside 1–3999. */
export function toRoman(n: number): string | undefined {
  let rest = Math.round(n);
  if (!(rest >= 1 && rest <= 3999)) return undefined;
  let out = '';
  for (const [v, s] of NUMERALS) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out;
}

/** The value of well-formed Roman numerals, either case; NaN otherwise. */
export function fromRoman(text: string): number {
  const t = text.trim().toUpperCase();
  if (!/^[MDCLXVI]+$/.test(t)) return Number.NaN;
  let total = 0;
  let i = 0;
  for (const [v, s] of NUMERALS) {
    while (t.startsWith(s, i)) {
      total += v;
      i += s.length;
    }
  }
  // Anything left unread, or a non-canonical spelling such as `IIII`, is not a numeral.
  return i === t.length && toRoman(total) === t ? total : Number.NaN;
}

/** The built-in `roman` kind, to spread into a `registerDisplayKind` replacement. */
export const romanKind: DisplayKind<RomanDisplay> = {
  kind: 'roman',
  format: (value, d, ctx) => {
    const r = toRoman(value);
    if (r === undefined) return [numberPart(value, ctx.locale, { maximumFractionDigits: 0 })];
    return [{ type: 'numeral', value: d.lower ? r.toLowerCase() : r }];
  },
  speak: (value, _d, ctx) => spokenSign(numberPart(Math.round(value), ctx.locale, { maximumFractionDigits: 0, useGrouping: false }).value),
  parse: (text, _d, ctx) => {
    const r = fromRoman(text);
    return Number.isNaN(r) ? parseNumber(text, undefined, ctx.locale) : r;
  },
};

/** A whole number as an ordinal: `1st`, `22nd`, `113th`. English suffixes;
 *  in any other locale the number shows alone. */
export type OrdinalDisplay = {
  kind: 'ordinal';
};

/** An {@link OrdinalDisplay}. */
export function ordinal(): OrdinalDisplay {
  return { kind: 'ordinal' };
}

const SUFFIXES: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' };

/** The built-in `ordinal` kind, to spread into a `registerDisplayKind` replacement. */
export const ordinalKind: DisplayKind<OrdinalDisplay> = {
  kind: 'ordinal',
  format: (value, _d, ctx) => {
    const n = Math.round(value);
    const number = numberPart(n, ctx.locale, { maximumFractionDigits: 0 });
    if (!Number.isFinite(n) || !ctx.locale.startsWith('en')) return [number];
    const rule = new Intl.PluralRules('en-US', { type: 'ordinal' }).select(n);
    return [number, { type: 'ordinal', value: SUFFIXES[rule] ?? 'th' }];
  },
  parse: (text, _d, ctx) => Math.round(parseNumber(text.replace(/(st|nd|rd|th)\s*$/i, ''), undefined, ctx.locale)),
};
