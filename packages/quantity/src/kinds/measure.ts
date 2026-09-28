import { intlParts, numberPart, plural, spokenSign, textOf, type DisplayKind, type Part } from '../kind';
import { decimalOf, escapeClass, latinDigits, parseNumber, type UnitTable } from '../number';

/**
 * Units `Intl` can name aloud, by the symbol a field shows. A unit outside it
 * speaks through the display's `spoken` names, else as its symbol.
 */
const INTL_UNITS: Record<string, string> = {
  mm: 'millimeter',
  cm: 'centimeter',
  m: 'meter',
  km: 'kilometer',
  in: 'inch',
  '"': 'inch',
  '″': 'inch',
  ft: 'foot',
  "'": 'foot',
  '′': 'foot',
  yd: 'yard',
  mi: 'mile',
  deg: 'degree',
  '°': 'degree',
  ms: 'millisecond',
  s: 'second',
  min: 'minute',
  h: 'hour',
  g: 'gram',
  kg: 'kilogram',
  L: 'liter',
  '%': 'percent',
};

/** Names for common units `Intl` has none for. */
const OWN_UNITS: Record<string, readonly [string, string]> = {
  px: ['pixel', 'pixels'],
  pt: ['point', 'points'],
  rad: ['radian', 'radians'],
  turn: ['turn', 'turns'],
};

/**
 * A number with its unit: `12mm`, spoken `12 millimeters`. The unit is the
 * display's, else the one the value is tagged with. `accepts` is what a person
 * may type, each unit mapped to its conversion into the shown one; compound
 * text such as `5ft 3in` reads when every term's unit is accepted.
 */
export type UnitDisplay = {
  kind: 'unit';
  unit?: string;
  /** Most decimals, trailing zeros dropped. Default 2. */
  places?: number;
  /** A space between number and unit. Default false. */
  space?: boolean;
  accepts?: UnitTable;
  /** Singular and plural names, for a unit `Intl` cannot name. */
  spoken?: readonly [string, string];
};

export function unit(name?: string, options: Omit<UnitDisplay, 'kind' | 'unit'> = {}): UnitDisplay {
  return name === undefined ? { kind: 'unit', ...options } : { kind: 'unit', unit: name, ...options };
}

export const unitKind: DisplayKind<UnitDisplay> = {
  kind: 'unit',
  format: (value, d, ctx) => {
    const parts: Part[] = [numberPart(value, ctx.locale, { maximumFractionDigits: d.places ?? 2, useGrouping: false })];
    const name = d.unit ?? ctx.unit;
    if (name) {
      if (d.space) parts.push({ type: 'literal', value: ' ' });
      parts.push({ type: 'unit', value: name });
    }
    return parts;
  },
  speak: (value, d, ctx) => {
    const places = d.places ?? 2;
    const name = d.unit ?? ctx.unit;
    const intl = name === undefined ? undefined : INTL_UNITS[name];
    if (intl !== undefined && d.spoken === undefined) {
      return spokenSign(
        textOf(intlParts(value, ctx.locale, { style: 'unit', unit: intl, unitDisplay: 'long', maximumFractionDigits: places })),
      );
    }
    const number = numberPart(value, ctx.locale, { maximumFractionDigits: places, useGrouping: false }).value;
    const names = d.spoken ?? (name === undefined ? undefined : OWN_UNITS[name]);
    const word = names ? plural(value, ctx.locale, names[0], names[1]) : name;
    return spokenSign(word ? `${number} ${word}` : number);
  },
  parse: (text, d, ctx) => {
    const name = d.unit ?? ctx.unit;
    return parseNumber(text, d.accepts ?? (name ? { [name]: 1 } : undefined), ctx.locale);
  },
};

/** Money in an ISO 4217 currency: `$12.50`, spoken `12.50 US dollars`. */
export type CurrencyDisplay = {
  kind: 'currency';
  currency: string;
  /** Fixed decimals. Defaults to the currency's own (2 for USD, 0 for JPY). */
  places?: number;
};

export function currency(code: string, options: Omit<CurrencyDisplay, 'kind' | 'currency'> = {}): CurrencyDisplay {
  return { kind: 'currency', currency: code, ...options };
}

function currencyOptions(d: CurrencyDisplay): Intl.NumberFormatOptions {
  const options: Intl.NumberFormatOptions = { style: 'currency', currency: d.currency };
  if (d.places !== undefined) {
    options.minimumFractionDigits = d.places;
    options.maximumFractionDigits = d.places;
  }
  return options;
}

export const currencyKind: DisplayKind<CurrencyDisplay> = {
  kind: 'currency',
  format: (value, d, ctx) => intlParts(value, ctx.locale, currencyOptions(d)),
  speak: (value, d, ctx) =>
    spokenSign(textOf(intlParts(value, ctx.locale, { ...currencyOptions(d), currencyDisplay: 'name' }))),
  parse: (text, _d, ctx) => parseNumber(text.replace(/[^\d.,'’+\-−]/g, ''), undefined, ctx.locale),
};

/**
 * A span of time, the value in seconds. `clock` shows `1:02:03` or `4:05.5`;
 * `units` shows `2h 5m 3s`. Spoken `2 hours, 5 minutes, 3 seconds`. Typed text
 * reads in either form.
 */
export type DurationDisplay = {
  kind: 'duration';
  /** Default `'clock'`. */
  style?: 'clock' | 'units';
  /** Decimals on the seconds. Default 0. */
  places?: number;
};

export function duration(options: Omit<DurationDisplay, 'kind'> = {}): DurationDisplay {
  return { kind: 'duration', ...options };
}

/** Hours, minutes and seconds of `value` after rounding to `places`. */
function hms(value: number, places: number) {
  const scale = 10 ** places;
  const total = Math.round(Math.abs(value) * scale) / scale;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total - h * 3600) / 60);
  const s = Math.round((total - h * 3600 - m * 60) * scale) / scale;
  return { negative: value < 0 && total > 0, h, m, s };
}

const DURATION_UNITS: UnitTable = { h: 3600, m: 60, min: 60, s: 1, ms: 0.001 };

export const durationKind: DisplayKind<DurationDisplay> = {
  kind: 'duration',
  format: (value, d) => {
    if (!Number.isFinite(value)) return [{ type: 'number', value: String(value) }];
    const places = d.places ?? 0;
    const { negative, h, m, s } = hms(value, places);
    const sec = s.toFixed(places);
    const parts: Part[] = negative ? [{ type: 'sign', value: '−' }] : [];
    if (d.style === 'units') {
      const terms: Part[][] = [];
      if (h > 0) terms.push([{ type: 'hours', value: String(h) }, { type: 'unit', value: 'h' }]);
      if (m > 0) terms.push([{ type: 'minutes', value: String(m) }, { type: 'unit', value: 'm' }]);
      if (s > 0 || terms.length === 0) terms.push([{ type: 'seconds', value: sec }, { type: 'unit', value: 's' }]);
      terms.forEach((t, i) => parts.push(...(i > 0 ? [{ type: 'literal', value: ' ' }] : []), ...t));
      return parts;
    }
    const pad = (n: string) => (n.split('.')[0]!.length < 2 ? `0${n}` : n);
    if (h > 0) {
      parts.push(
        { type: 'hours', value: String(h) },
        { type: 'literal', value: ':' },
        { type: 'minutes', value: pad(String(m)) },
      );
    } else {
      parts.push({ type: 'minutes', value: String(m) });
    }
    parts.push({ type: 'literal', value: ':' }, { type: 'seconds', value: pad(sec) });
    return parts;
  },
  speak: (value, d, ctx) => {
    if (!Number.isFinite(value)) return String(value);
    const { negative, h, m, s } = hms(value, d.places ?? 0);
    const terms: string[] = [];
    if (h > 0) terms.push(`${h} ${plural(h, ctx.locale, 'hour', 'hours')}`);
    if (m > 0) terms.push(`${m} ${plural(m, ctx.locale, 'minute', 'minutes')}`);
    if (s > 0 || terms.length === 0) terms.push(`${s} ${plural(s, ctx.locale, 'second', 'seconds')}`);
    return `${negative ? 'minus ' : ''}${terms.join(', ')}`;
  },
  parse: (text, _d, ctx) => {
    const d = escapeClass(decimalOf(ctx.locale));
    const clock = new RegExp(String.raw`^\s*([-−+]?)\s*(?:(\d+):)?(\d+):(\d+)(?:[.${d}](\d+))?\s*$`);
    const m = clock.exec(latinDigits(text, ctx.locale));
    if (!m) return parseNumber(text, DURATION_UNITS, ctx.locale);
    const total = Number(m[2] ?? 0) * 3600 + Number(m[3]) * 60 + Number(`${m[4]}.${m[5] ?? 0}`);
    return m[1] === '-' || m[1] === '−' ? -total : total;
  },
};

const DECIMAL_BYTES = ['B', 'kB', 'MB', 'GB', 'TB', 'PB'] as const;
const BINARY_BYTES = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'] as const;
const DECIMAL_NAMES = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'] as const;
const BINARY_NAMES = ['byte', 'kibibyte', 'mebibyte', 'gibibyte', 'tebibyte', 'pebibyte'] as const;

/** A byte count in the largest unit that keeps it at or above 1: `1.2 MB`,
 *  spoken `1.2 megabytes`. `base: 1024` uses `KiB`, `MiB`, … */
export type BytesDisplay = {
  kind: 'bytes';
  /** Default 1000. */
  base?: 1000 | 1024;
  /** Most decimals. Default 1. */
  places?: number;
};

export function bytes(options: Omit<BytesDisplay, 'kind'> = {}): BytesDisplay {
  return { kind: 'bytes', ...options };
}

function byteScale(value: number, base: number): { scaled: number; step: number } {
  let step = 0;
  let scaled = value;
  while (Math.abs(scaled) >= base && step < DECIMAL_BYTES.length - 1) {
    scaled /= base;
    step++;
  }
  return { scaled, step };
}

const BYTE_UNITS: UnitTable = Object.fromEntries([
  ...DECIMAL_BYTES.map((u, i) => [u, 1000 ** i] as const),
  ['KB', 1000],
  ...BINARY_BYTES.slice(1).map((u, i) => [u, 1024 ** (i + 1)] as const),
]);

export const bytesKind: DisplayKind<BytesDisplay> = {
  kind: 'bytes',
  format: (value, d, ctx) => {
    const base = d.base ?? 1000;
    const { scaled, step } = byteScale(value, base);
    const units = base === 1024 ? BINARY_BYTES : DECIMAL_BYTES;
    return [
      numberPart(scaled, ctx.locale, { maximumFractionDigits: step === 0 ? 0 : (d.places ?? 1) }),
      { type: 'literal', value: ' ' },
      { type: 'unit', value: units[step]! },
    ];
  },
  speak: (value, d, ctx) => {
    const base = d.base ?? 1000;
    const { scaled, step } = byteScale(value, base);
    const name = (base === 1024 ? BINARY_NAMES : DECIMAL_NAMES)[step]!;
    const number = numberPart(scaled, ctx.locale, { maximumFractionDigits: step === 0 ? 0 : (d.places ?? 1) }).value;
    return spokenSign(`${number} ${plural(Math.abs(parseNumber(number, undefined, ctx.locale)), ctx.locale, name, `${name}s`)}`);
  },
  parse: (text, _d, ctx) => parseNumber(text, BYTE_UNITS, ctx.locale),
};
