import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseUnitExpr, resolveUnitExpr, type UnitExpr, type UnitExprContext } from './unitExpr';
import { IMPERIAL_INCHES, type UnitSystem } from './units';
import { runs, timeoutFor } from './pbt.fixture';

const RUNS = runs(300);
const TIMEOUT = timeoutFor(300, 1);

const TEMPERATURE: UnitSystem = { base: 'K', units: { K: 1, degC: { factor: 1, offset: 273.15 } } };
const CTX: UnitExprContext = { unitSystem: IMPERIAL_INCHES, percentOf: 48 };

/** A non-negative literal written without an exponent, as the tokenizer reads one. */
const literal = fc.record({
  n: fc.integer({ min: 0, max: 1_000_000 }),
  places: fc.integer({ min: 0, max: 4 }),
  unit: fc.constantFrom(undefined, 'in', 'ft', 'yd', 'mi', '%', '"', "'", '′'),
}).map(({ n, places, unit }): UnitExpr => (unit === undefined ? { op: 'value', value: n / 10 ** places } : { op: 'value', value: n / 10 ** places, unit }));

const tree: fc.Arbitrary<UnitExpr> = fc.letrec<{ e: UnitExpr }>((tie) => ({
  e: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    { weight: 3, arbitrary: literal },
    { weight: 1, arbitrary: tie('e').map((of): UnitExpr => ({ op: 'neg', of })) },
    {
      weight: 2,
      arbitrary: fc.tuple(fc.constantFrom('add', 'sub', 'mul', 'div') as fc.Arbitrary<'add' | 'sub' | 'mul' | 'div'>, tie('e'), tie('e'))
        .map(([op, left, right]): UnitExpr => ({ op, left, right })),
    },
  ),
})).e;

const GLYPH = { add: ['+'], sub: ['-', '−'], mul: ['*', '×'], div: ['/', '÷'] } as const;

/** `e` as text, every operation in parentheses, with the spacing and glyphs `pick` chooses. */
function print(e: UnitExpr, pick: () => number = () => 0): string {
  const sp = () => [' ', '', '  '][pick() % 3]!;
  switch (e.op) {
    case 'value': {
      const unitGap = e.unit === undefined || pick() % 2 === 0 ? '' : ' ';
      const text = `${Math.abs(e.value)}${unitGap}${e.unit ?? ''}`;
      return e.value < 0 || Object.is(e.value, -0) ? `-${text}` : text;
    }
    case 'neg':
      return `-(${print(e.of, pick)})`;
    default: {
      const glyphs = GLYPH[e.op];
      return `(${print(e.left, pick)}${sp()}${glyphs[pick() % glyphs.length]}${sp()}${print(e.right, pick)})`;
    }
  }
}

/** What resolving `e` does: its value, or the message it throws with. */
function outcome(run: () => number): { value: number } | { error: string } {
  try {
    return { value: run() };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

const picks = fc.array(fc.nat(), { minLength: 1, maxLength: 64 }).map((xs) => {
  let i = 0;
  return () => xs[i++ % xs.length]!;
});

describe('parseUnitExpr and resolveUnitExpr, property', () => {
  it('reads a printed expression back to the same tree, up to folded signs', () => {
    fc.assert(fc.property(tree, picks, (e, pick) => {
      const text = print(e, pick);
      const parsed = parseUnitExpr(text);
      expect(parseUnitExpr(print(parsed)), text).toEqual(parsed);
    }), RUNS);
  }, TIMEOUT);

  it('resolves printed text to what the tree it was printed from resolves to', () => {
    const tally = { value: 0, error: 0 };
    fc.assert(fc.property(tree, picks, (e, pick) => {
      const text = print(e, pick);
      const want = outcome(() => resolveUnitExpr(e, CTX));
      const got = outcome(() => resolveUnitExpr(text, CTX));
      if ('value' in want) tally.value++;
      else tally.error++;
      // The parser folds a minus into a literal (−(3) is −3), which can only spare a value an error, never change it.
      if ('value' in got && 'value' in want) expect(Object.is(got.value, want.value) || got.value === want.value, text).toBe(true);
      else expect(got, text).toEqual(want);
    }), RUNS);
    expect(tally.value).toBeGreaterThan(RUNS.numRuns / 10);
    expect(tally.error).toBeGreaterThan(0);
  }, TIMEOUT);

  it('reads adjacent terms as one sum, and a leading sign across all of them', () => {
    const term = fc.tuple(fc.integer({ min: 0, max: 1000 }), fc.constantFrom('in', 'ft', 'yd'));
    fc.assert(fc.property(fc.array(term, { minLength: 1, maxLength: 4 }), fc.constantFrom('', '-', '−', '+'), (terms, sign) => {
      const text = sign + terms.map(([n, u]) => `${n}${u}`).join(' ');
      const total = terms.reduce((sum, [n, u]) => sum + n * (IMPERIAL_INCHES.units[u] as number), 0);
      const got = resolveUnitExpr(text, CTX);
      expect(got === (sign === '-' || sign === '−' ? -total : total), `${text} is ${got}`).toBe(true);
    }), RUNS);
  });

  it('throws only errors it names, and otherwise answers a finite number, whatever the text', () => {
    const unit = fc.constantFrom(...'0123456789.+-−*×/÷() %inftydegCK"\'′e '.split(''));
    const ctx = fc.constantFrom<UnitExprContext>(CTX, {}, { unitSystem: TEMPERATURE }, { percentOf: 10 });
    const tally = { read: 0 };
    fc.assert(fc.property(fc.string({ unit, maxLength: 30 }), ctx, (text, c) => {
      const got = outcome(() => resolveUnitExpr(text, c));
      if ('error' in got) {
        expect(got.error, JSON.stringify(text)).toMatch(/^unitExpr: /);
        return;
      }
      tally.read++;
      expect(Number.isFinite(got.value), JSON.stringify(text)).toBe(true);
    }), { numRuns: RUNS.numRuns * 3 });
    expect(tally.read).toBeGreaterThan(0);
  }, TIMEOUT * 3);
});
