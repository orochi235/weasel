import { intlParts, spokenSign, textOf, type DisplayKind } from '../kind';
import { formatCompact, parseNumber } from '../number';

/** A plain number. `places` fixes the decimals, trailing zeros included;
 *  otherwise up to `maxPlaces` (default 3) show and trailing zeros drop. */
export type DecimalDisplay = {
  kind: 'decimal';
  places?: number;
  maxPlaces?: number;
  /** Thousands separators. Default true. */
  grouping?: boolean;
};

export function decimal(options: Omit<DecimalDisplay, 'kind'> = {}): DecimalDisplay {
  return { kind: 'decimal', ...options };
}

export const decimalKind: DisplayKind<DecimalDisplay> = {
  kind: 'decimal',
  format: (value, d, ctx) => intlParts(value, ctx.locale, decimalOptions(d)),
  speak: (value, d, ctx) => spokenSign(textOf(intlParts(value, ctx.locale, decimalOptions(d)))),
  parse: (text) => parseNumber(text),
};

function decimalOptions(d: DecimalDisplay): Intl.NumberFormatOptions {
  const grouping = d.grouping ?? true;
  return d.places === undefined
    ? { maximumFractionDigits: d.maxPlaces ?? 3, useGrouping: grouping }
    : { minimumFractionDigits: d.places, maximumFractionDigits: d.places, useGrouping: grouping };
}

/** A whole number, rounded. */
export type IntegerDisplay = {
  kind: 'integer';
  grouping?: boolean;
};

export function integer(options: Omit<IntegerDisplay, 'kind'> = {}): IntegerDisplay {
  return { kind: 'integer', ...options };
}

export const integerKind: DisplayKind<IntegerDisplay> = {
  kind: 'integer',
  format: (value, d, ctx) =>
    intlParts(value, ctx.locale, { maximumFractionDigits: 0, useGrouping: d.grouping ?? true }),
  speak: (value, d, ctx) =>
    spokenSign(textOf(integerKind.format(value, d, ctx))),
  parse: (text) => Math.round(parseNumber(text)),
};

/**
 * Below 1,000 at `places` decimals, from 1,000 up at three significant figures
 * with a magnitude suffix (`40.0K`, `2.00M`), so a readout holds one width.
 * Spoken long: `2 million`.
 */
export type CompactDisplay = {
  kind: 'compact';
  places?: number;
};

export function compact(options: Omit<CompactDisplay, 'kind'> = {}): CompactDisplay {
  return { kind: 'compact', ...options };
}

export const compactKind: DisplayKind<CompactDisplay> = {
  kind: 'compact',
  format: (value, d) => {
    const text = formatCompact(value, d.places ?? 0);
    const m = /^(.*?\d)([A-Za-z]+)$/.exec(text);
    return m
      ? [
          { type: 'number', value: m[1]! },
          { type: 'compact', value: m[2]! },
        ]
      : [{ type: 'number', value: text }];
  },
  speak: (value, d, ctx) =>
    spokenSign(
      textOf(
        Math.abs(value) < 1000
          ? compactKind.format(value, d, ctx)
          : intlParts(value, ctx.locale, {
              notation: 'compact',
              compactDisplay: 'long',
              maximumSignificantDigits: 3,
            }),
      ),
    ),
  parse: (text) => parseNumber(text),
};
