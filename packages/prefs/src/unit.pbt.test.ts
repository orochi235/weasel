import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { resolvePrefUnit } from './unit';

/** A short decimal as its digits and places, and as a number. */
const decimal = (digits: number, places: number) =>
  fc.record({ n: fc.integer({ min: -(10 ** digits), max: 10 ** digits }), p: fc.integer({ min: 0, max: places }) })
    .map(({ n, p }) => ({ n: BigInt(n), p, value: n / 10 ** p }));

/** `a * b + c` exactly, as the double nearest it. */
function exact(a: { n: bigint; p: number }, b: { n: bigint; p: number }, c: { n: bigint; p: number }): number {
  const places = Math.max(a.p + b.p, c.p);
  const sum = a.n * b.n * 10n ** BigInt(places - a.p - b.p) + c.n * 10n ** BigInt(places - c.p);
  const neg = sum < 0n;
  const digits = (neg ? -sum : sum).toString().padStart(places + 1, '0');
  return Number(`${neg ? '-' : ''}${digits.slice(0, digits.length - places)}.${digits.slice(digits.length - places) || '0'}`);
}

describe('linear prefs units, properties', () => {
  it('stores a short decimal typed at a short decimal scale and offset as the decimal they make', () => {
    const t = tally();
    fc.assert(
      fc.property(decimal(6, 3), decimal(4, 4).filter((s) => s.n !== 0n), decimal(4, 3), (shown, scale, offset) => {
        const unit = resolvePrefUnit({ scale: scale.value, offset: offset.value });
        const stored = unit.fromDisplay(shown.value);
        const want = exact(shown, scale, offset);
        t.count(shown.value * scale.value + offset.value === want ? 'binary exact' : 'binary off');
        expect(stored).toBe(want);
        expect(unit.toDisplayExact(stored)).toBeCloseTo(shown.value, 6);
      }),
      runs(500),
    );
    t.atLeast('binary off', 20);
  }, timeoutFor(500, 1));

  it('shows a stored value rounded to its precision, within half a place of the exact one', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), fc.constantFrom(1, 0.1, Math.PI / 180, 25.4, 2.54), fc.integer({ min: 0, max: 4 }), (stored, scale, precision) => {
        const unit = resolvePrefUnit({ scale, precision });
        const shown = unit.toDisplay(stored);
        expect(Math.abs(shown - stored / scale)).toBeLessThanOrEqual(0.5 * 10 ** -precision * (1 + 1e-9) + Math.abs(stored / scale) * 1e-15);
        expect(Number(shown.toFixed(precision)) === shown).toBe(true);
      }),
      runs(500),
    );
  }, timeoutFor(500, 1));
});
