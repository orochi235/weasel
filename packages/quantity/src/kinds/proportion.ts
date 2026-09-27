import { intlParts, numberPart, spokenSign, textOf, type DisplayKind, type Part } from '../kind';
import { MINUS_SIGN, parseNumber } from '../number';

/** A share of one as a percentage: 0.25 shows `25%`. Typed text reads as
 *  percent with or without the sign. */
export type PercentDisplay = {
  kind: 'percent';
  /** Most decimals shown. Default 0. */
  places?: number;
};

export function percent(options: Omit<PercentDisplay, 'kind'> = {}): PercentDisplay {
  return { kind: 'percent', ...options };
}

export const percentKind: DisplayKind<PercentDisplay> = {
  kind: 'percent',
  format: (value, d, ctx) =>
    intlParts(value, ctx.locale, { style: 'percent', maximumFractionDigits: d.places ?? 0 }),
  speak: (value, d, ctx) =>
    spokenSign(
      textOf(
        intlParts(value * 100, ctx.locale, {
          style: 'unit',
          unit: 'percent',
          unitDisplay: 'long',
          maximumFractionDigits: d.places ?? 0,
        }),
      ),
    ),
  parse: (text) => parseNumber(text.replace(/%\s*$/, '')) / 100,
};

/**
 * The nearest fraction whose denominator is at most `maxDenominator`, as
 * `[numerator, denominator]` in lowest terms with the sign on the numerator.
 * Walks the continued fraction and settles the last step on the best
 * semiconvergent, which is the closest any denominator in range can get.
 */
export function nearestFraction(x: number, maxDenominator: number): [number, number] {
  if (!Number.isFinite(x)) return [x, 1];
  const sign = x < 0 ? -1 : 1;
  const target = Math.abs(x);
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let y = target;
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(y);
    const k2 = a * k1 + k0;
    if (k2 > maxDenominator) {
      const t = Math.floor((maxDenominator - k0) / k1);
      const [hs, ks] = [t * h1 + h0, t * k1 + k0];
      if (Math.abs(hs / ks - target) < Math.abs(h1 / k1 - target)) [h1, k1] = [hs, ks];
      break;
    }
    [h0, h1, k0, k1] = [h1, a * h1 + h0, k1, k2];
    const rest = y - a;
    if (rest < 1e-12 || Math.abs(h1 / k1 - target) < 1e-15) break;
    y = 1 / rest;
  }
  return [sign * h1, k1];
}

/**
 * A constant a fraction can count in: `π`, so 3π/4 shows as `3π/4` rather
 * than `2.356`. `names` are what may be typed for it besides the symbol.
 */
export interface NamedConstant {
  symbol: string;
  value: number;
  /** How it is read aloud: `pi`. */
  spoken: string;
  names?: readonly string[];
}

/** The constants `fraction({ of })` knows by symbol. */
export const CONSTANTS = {
  π: { symbol: 'π', value: Math.PI, spoken: 'pi', names: ['pi'] },
  τ: { symbol: 'τ', value: 2 * Math.PI, spoken: 'tau', names: ['tau'] },
  e: { symbol: 'e', value: Math.E, spoken: 'e' },
} as const satisfies Record<string, NamedConstant>;

type FractionOptions = {
  /** Default 64. */
  maxDenominator?: number;
  /**
   * `inline` (default) writes `1/12`. `diagonal` writes `¹⁄₁₂` — superscript
   * digits, the fraction slash, subscript digits — so the text itself is
   * diagonal wherever it is drawn, CSS or not.
   */
  form?: 'inline' | 'diagonal';
} & (
  | { mixed?: boolean; of?: never }
  | {
      /**
       * Count in a constant: with `π`, 3π/4 shows `3π/4` and is spoken `3 pi
       * over 4`. Excludes `mixed`, since `1 1/2π` reads as 1 + ½π.
       */
      of: keyof typeof CONSTANTS | NamedConstant;
      mixed?: never;
    }
);

/**
 * A value as the nearest fraction: 1/12 shows `1/12` and is spoken `1 over 12`.
 * `mixed` splits a whole part off (`1 1/2`); a whole value shows as an integer.
 * Has a MathML form, as `<mfrac>`.
 */
export type FractionDisplay = { kind: 'fraction' } & FractionOptions;

const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';

const inDigits = (n: number, digits: string) => String(n).replace(/\d/g, (c) => digits[Number(c)]!);
const fromDigits = (text: string, digits: string) =>
  Number([...text].map((c) => digits.indexOf(c)).join(''));

export function fraction(options: FractionOptions = {}): FractionDisplay {
  return { kind: 'fraction', ...options };
}

function constantOf(d: FractionDisplay): NamedConstant | undefined {
  return typeof d.of === 'string' ? CONSTANTS[d.of] : d.of;
}

/** A fraction's pieces: sign, whole part (mixed only), numerator, denominator,
 *  and the constant they count in. */
function fractionPieces(value: number, d: FractionDisplay) {
  const constant = constantOf(d);
  const [n, den] = nearestFraction(constant ? value / constant.value : value, d.maxDenominator ?? 64);
  const negative = n < 0;
  const abs = Math.abs(n);
  const whole = d.mixed || den === 1 ? Math.floor(abs / den) : 0;
  return { negative, whole, num: abs - whole * den, den, constant };
}

/** A fraction typed inline (`1 1/2`) or diagonally (`1¹⁄₂`), else a plain number. */
function parseFraction(text: string): number {
  const inline = /^\s*([-−+]?)\s*(?:(\d+)\s+)?(\d+)\s*[/⁄]\s*(\d+)\s*$/.exec(text);
  const diagonal = /^\s*([-−+]?)\s*(\d+)?\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*[/⁄]\s*([₀₁₂₃₄₅₆₇₈₉]+)\s*$/.exec(text);
  let magnitude: number;
  if (inline) magnitude = Number(inline[2] ?? 0) + Number(inline[3]) / Number(inline[4]);
  else if (diagonal) {
    magnitude = Number(diagonal[2] ?? 0) + fromDigits(diagonal[3]!, SUPERSCRIPT) / fromDigits(diagonal[4]!, SUBSCRIPT);
  } else return parseNumber(text);
  const sign = (inline ?? diagonal)![1];
  return sign === '-' || sign === MINUS_SIGN ? -magnitude : magnitude;
}

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const fractionKind: DisplayKind<FractionDisplay> = {
  kind: 'fraction',
  format: (value, d) => {
    if (!Number.isFinite(value)) return [{ type: 'number', value: String(value) }];
    const { negative, whole, num, den, constant } = fractionPieces(value, d);
    const diagonal = d.form === 'diagonal';
    const symbol: Part[] = constant ? [{ type: 'constant', value: constant.symbol }] : [];
    const parts: Part[] = [];
    if (negative) parts.push({ type: 'sign', value: MINUS_SIGN });
    if (num === 0) {
      if (whole === 0) return [...parts, { type: 'whole', value: '0' }];
      if (!(constant && whole === 1)) parts.push({ type: 'whole', value: String(whole) });
      return [...parts, ...symbol];
    }
    if (whole > 0) {
      parts.push({ type: 'whole', value: String(whole) });
      if (!diagonal) parts.push({ type: 'literal', value: ' ' });
    }
    if (diagonal) {
      parts.push(
        { type: 'numerator', value: inDigits(num, SUPERSCRIPT) },
        { type: 'literal', value: '⁄' },
        { type: 'denominator', value: inDigits(den, SUBSCRIPT) },
        ...symbol,
      );
    } else {
      if (!(constant && num === 1)) parts.push({ type: 'numerator', value: String(num) });
      parts.push(...symbol, { type: 'literal', value: '/' }, { type: 'denominator', value: String(den) });
    }
    return parts;
  },
  speak: (value, d) => {
    if (!Number.isFinite(value)) return String(value);
    const { negative, whole, num, den, constant } = fractionPieces(value, d);
    const counted = (n: number) => (!constant ? String(n) : n === 1 ? constant.spoken : `${n} ${constant.spoken}`);
    const words = [
      whole > 0 ? counted(whole) : num === 0 ? '0' : '',
      whole > 0 && num > 0 ? 'and' : '',
      num > 0 ? `${counted(num)} over ${den}` : '',
    ].filter(Boolean);
    return `${negative ? 'minus ' : ''}${words.join(' ')}`;
  },
  parse: (text, d) => {
    const constant = constantOf(d);
    if (!constant) return parseFraction(text);
    const spellings = [constant.symbol, ...(constant.names ?? [])].sort((a, b) => b.length - a.length);
    const token = new RegExp(spellings.map(escape).join('|'), 'i');
    if (!token.test(text)) return parseFraction(text);
    // With the constant taken out, a bare `/2` or nothing at all counts one of it.
    const coefficient = text.replace(token, '').replace(/^(\s*[-−+]?\s*)(?=[/⁄]|\s*$)/, '$11');
    return parseFraction(coefficient) * constant.value;
  },
  mathml: (value, d) => {
    if (!Number.isFinite(value)) return undefined;
    const { negative, whole, num, den, constant } = fractionPieces(value, d);
    const counted = (n: number) => {
      if (!constant) return `<mn>${n}</mn>`;
      const mi = `<mi>${constant.symbol}</mi>`;
      return n === 1 ? mi : `<mn>${n}</mn>${mi}`;
    };
    const body = [
      negative ? `<mo>${MINUS_SIGN}</mo>` : '',
      whole > 0 ? counted(whole) : num === 0 ? '<mn>0</mn>' : '',
      num > 0 ? `<mfrac>${num === 1 || !constant ? counted(num) : `<mrow>${counted(num)}</mrow>`}<mn>${den}</mn></mfrac>` : '',
    ].join('');
    return `<math>${body}</math>`;
  },
};

/** A value as a ratio `a:b` — 1/12 shows `1:12`, spoken `1 to 12`. */
export type RatioDisplay = {
  kind: 'ratio';
  /** Largest second term. Default 64. */
  maxDenominator?: number;
};

export function ratio(options: Omit<RatioDisplay, 'kind'> = {}): RatioDisplay {
  return { kind: 'ratio', ...options };
}

export const ratioKind: DisplayKind<RatioDisplay> = {
  kind: 'ratio',
  format: (value, d) => {
    if (!Number.isFinite(value)) return [{ type: 'number', value: String(value) }];
    const [n, den] = nearestFraction(value, d.maxDenominator ?? 64);
    return [
      { type: 'antecedent', value: String(n).replace(/^-/, MINUS_SIGN) },
      { type: 'literal', value: ':' },
      { type: 'consequent', value: String(den) },
    ];
  },
  speak: (value, d) => {
    if (!Number.isFinite(value)) return String(value);
    const [n, den] = nearestFraction(value, d.maxDenominator ?? 64);
    return spokenSign(`${String(n).replace(/^-/, MINUS_SIGN)} to ${den}`);
  },
  parse: (text) => {
    const m = /^\s*(.+?)\s*:\s*(.+?)\s*$/.exec(text);
    return m ? parseNumber(m[1]!) / parseNumber(m[2]!) : parseNumber(text);
  },
};

/** A factor with a times sign: `2.5×`, spoken `2.5 times`. Typed `x` reads too. */
export type MultiplierDisplay = {
  kind: 'multiplier';
  /** Most decimals. Default 2. */
  places?: number;
  /** Default `×`. */
  symbol?: string;
};

export function multiplier(options: Omit<MultiplierDisplay, 'kind'> = {}): MultiplierDisplay {
  return { kind: 'multiplier', ...options };
}

export const multiplierKind: DisplayKind<MultiplierDisplay> = {
  kind: 'multiplier',
  format: (value, d, ctx) => [
    numberPart(value, ctx.locale, { maximumFractionDigits: d.places ?? 2 }),
    { type: 'symbol', value: d.symbol ?? '×' },
  ],
  speak: (value, d, ctx) =>
    spokenSign(`${numberPart(value, ctx.locale, { maximumFractionDigits: d.places ?? 2 }).value} times`),
  parse: (text) => parseNumber(text.replace(/\s*[x×X]\s*$/, '')),
};

/**
 * A zoom factor. At 2x and below a percentage reads naturally; past it a
 * multiplier is what people say, so 2.5 shows `2.5x`. Past 100x a tenth is
 * noise: `1009.74` shows `1,010x`. Typed text without a sign reads as percent.
 */
export type ZoomDisplay = {
  kind: 'zoom';
};

export function zoom(): ZoomDisplay {
  return { kind: 'zoom' };
}

function zoomParts(z: number): Part[] {
  if (!Number.isFinite(z)) return [{ type: 'number', value: String(z) }];
  const n = (v: number, grouping = false) =>
    ({ type: 'number', value: v.toLocaleString('en-US', { useGrouping: grouping, maximumFractionDigits: 1 }).replace(/^-/, MINUS_SIGN) });
  if (z <= 2) return [n(Math.round(z * 100)), { type: 'percentSign', value: '%' }];
  if (z >= 100) return [n(Math.round(z), true), { type: 'symbol', value: 'x' }];
  return [n(Math.round(z * 10) / 10), { type: 'symbol', value: 'x' }];
}

export const zoomKind: DisplayKind<ZoomDisplay> = {
  kind: 'zoom',
  format: (value) => zoomParts(value),
  speak: (value) =>
    spokenSign(
      zoomParts(value)
        .map((p) => (p.type === 'percentSign' ? ' percent' : p.type === 'symbol' ? ' times' : p.value))
        .join(''),
    ),
  parse: (text) => {
    const t = text.trim();
    if (/[x×X]$/.test(t)) return parseNumber(t.slice(0, -1));
    return parseNumber(t.replace(/%$/, '')) / 100;
  },
};
