/**
 * The quantity readers on very long typed text: a paste of a page of digits, signs, separators or unit names reads
 * in time linear in its length, answering a number or NaN (or `resolveUnitExpr`'s named error), never hanging.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseAs } from './present';
import { resolveUnitExpr } from './unitExpr';
import { decimal, integer } from './kinds/plain';
import { roman } from './kinds/numeral';
import { duration, unit } from './kinds/measure';
import { fraction, percent, ratio } from './kinds/proportion';
import type { Display } from './quantity';
import { locale, runs, timeoutFor } from './pbt.fixture';

const RUNS = runs(30);
const LENGTH = 20_000;
const BUDGET_MS = 250;

/** A run of one short piece repeated to `LENGTH`, with a junk tail that makes most of them fail at the end. */
const long = fc.tuple(
  fc.constantFrom('1', '9.', ',', ' ', '-', '−', '+', 'e', '1e', '0x', 'ft', ' ft', '1 ft ', '1/2', 'IV', 'M', '(', ')', '1:',
    '∞', 'inf', ' ', '.', '1,000', '1+', '-(', '2*'),
  fc.constantFrom('', 'x', ')', '.', ' ft', '%'),
).map(([piece, tail]) => piece.repeat(Math.ceil(LENGTH / piece.length)) + tail);

const display = fc.constantFrom<Display>(decimal(), integer(), roman(), unit('ft', { accepts: { ft: 12, in: 1 } }), duration(), fraction(), percent(), ratio());

function timed<T>(read: () => T): T {
  const t0 = performance.now();
  const out = read();
  expect(performance.now() - t0).toBeLessThan(BUDGET_MS);
  return out;
}

describe('quantity readers on very long text, property', () => {
  it('parseAs answers a number in bounded time', () => {
    fc.assert(fc.property(long, display, locale, (text, d, loc) => {
      expect(typeof timed(() => parseAs(text, d, { locale: loc }))).toBe('number');
    }), RUNS);
  }, timeoutFor(30, 3 * BUDGET_MS));

  it('resolveUnitExpr answers a number or its own named error in bounded time', () => {
    fc.assert(fc.property(long, (text) => {
      timed(() => {
        try {
          return resolveUnitExpr(text, { unitSystem: { base: 'in', units: { ft: 12, in: 1 } } });
        } catch (err) {
          if (err instanceof Error && err.message.startsWith('unitExpr: ')) return null;
          throw err;
        }
      });
    }), RUNS);
  }, timeoutFor(30, BUDGET_MS));
});

describe('quantity readers on very long text, shrunk counterexamples', () => {
  const ones = `${'1'.repeat(LENGTH)}x`;
  const spaces = `${' '.repeat(LENGTH)}x`;

  it('reads a long run of digits ending in junk as NaN in linear time', () => {
    expect(timed(() => parseAs(ones, decimal(), { locale: 'en-US' }))).toBeNaN();
  });

  it.each([['duration', duration()], ['fraction', fraction()], ['percent', percent()], ['ratio', ratio()]] as const)(
    'reads a long run of spaces as %s in linear time', (_name, d) => {
      expect(timed(() => parseAs(spaces, d, { locale: 'en-US' }))).toBeNaN();
    },
  );

  it('refuses parentheses nested past any typed expression with its own error, not a stack overflow', () => {
    expect(() => resolveUnitExpr(`${'('.repeat(LENGTH)}1`)).toThrow(/^unitExpr: .* nests more than \d+ levels deep$/);
  });
});
