import { escapeMarkup, spokenSign, type DisplayKind, type FormatContext, type Part } from '../kind';
import { MINUS_SIGN, parseNumber } from '../number';

/**
 * A mantissa times a power of ten at `digits` significant figures (default 3),
 * trailing zeros kept: `1.23 × 10⁶`. `engineering` keeps the exponent a multiple
 * of three (`12.3 × 10³`); `form: 'e'` writes it the way code does (`1.23e6`).
 * Zero shows as `0`.
 */
export type ScientificDisplay = {
  kind: 'scientific';
  digits?: number;
  engineering?: boolean;
  form?: 'superscript' | 'e';
};

/** A {@link ScientificDisplay}. */
export function scientific(options: Omit<ScientificDisplay, 'kind'> = {}): ScientificDisplay {
  return { kind: 'scientific', ...options };
}

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const superscript = (n: number): string =>
  (n < 0 ? '⁻' : '') + [...String(Math.abs(n))].map((d) => SUPERSCRIPT[Number(d)]).join('');

type Split = { mantissa: string; exponent: number } | null;

/** The mantissa as the locale writes it and the exponent, or null for zero. */
function split(value: number, d: ScientificDisplay, locale: string): Split {
  if (value === 0) return null;
  const digits = d.digits ?? 3;
  const nf = new Intl.NumberFormat(locale, {
    notation: d.engineering ? 'engineering' : 'scientific',
    minimumSignificantDigits: digits,
    maximumSignificantDigits: digits,
  });
  let mantissa = '';
  let exponent = '';
  for (const p of nf.formatToParts(value)) {
    if (p.type === 'exponentSeparator') continue;
    if (p.type === 'exponentMinusSign') exponent += '-';
    else if (p.type === 'exponentInteger') exponent += p.value;
    else mantissa += p.type === 'minusSign' ? MINUS_SIGN : p.value;
  }
  return { mantissa, exponent: Number(exponent) };
}

const zeroParts = (locale: string): Part[] => [{ type: 'number', value: (0).toLocaleString(locale) }];

/** `× 10^n`, `x10^n`, `*10^n`, and the superscript form, rewritten as the `e` form `parseNumber` reads. */
function asENotation(text: string): string {
  const raised = text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+$/, (s) => `^${[...s].map((c) => (c === '⁻' ? '-' : SUPERSCRIPT.indexOf(c))).join('')}`);
  const m = /^(?:(.*\d)\s*[×xX*·]\s*)?10\s*\^\s*([-−+]?\d+)$/.exec(raised.trim());
  if (m) return `${m[1] ?? '1'}e${m[2]!.replace(MINUS_SIGN, '-')}`;
  return text.replace(/(\d)[eE]−/, '$1e-');
}

/** The built-in `scientific` kind, to spread into a `registerDisplayKind` replacement. */
export const scientificKind: DisplayKind<ScientificDisplay> = {
  kind: 'scientific',
  format: (value, d, ctx) => {
    const s = split(value, d, ctx.locale);
    if (s === null) return zeroParts(ctx.locale);
    if (d.form === 'e') {
      const exponent = String(s.exponent).replace('-', MINUS_SIGN);
      return [{ type: 'number', value: s.mantissa }, { type: 'literal', value: 'e' }, { type: 'exponent', value: exponent }];
    }
    return [
      { type: 'number', value: s.mantissa },
      { type: 'literal', value: ' × ' },
      { type: 'base', value: '10' },
      { type: 'exponent', value: superscript(s.exponent) },
    ];
  },
  speak: (value, d, ctx: FormatContext) => {
    const s = split(value, d, ctx.locale);
    if (s === null) return zeroParts(ctx.locale)[0]!.value;
    return spokenSign(`${s.mantissa} times 10 to the power of ${spokenSign(String(s.exponent))}`);
  },
  parse: (text, _d, ctx) => parseNumber(asENotation(text), undefined, ctx.locale),
  mathml: (value, d, ctx) => {
    const s = split(value, d, ctx.locale);
    if (s === null) return undefined;
    const sign = s.mantissa.startsWith(MINUS_SIGN) ? `<mo>${MINUS_SIGN}</mo>` : '';
    const mantissa = `${sign}<mn>${escapeMarkup(s.mantissa.replace(MINUS_SIGN, ''))}</mn>`;
    const power = s.exponent < 0 ? `<mrow><mo>${MINUS_SIGN}</mo><mn>${-s.exponent}</mn></mrow>` : `<mn>${s.exponent}</mn>`;
    return `<math>${mantissa}<mo>×</mo><msup><mn>10</mn>${power}</msup></math>`;
  },
};
