/**
 * Property tests of how many of a bar's items fit before the rest overflow into its menu: all of them while any is
 * unmeasured or all fit, and otherwise the longest leading run that fits beside the menu button.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { fitting } from './useBarOverflow';

const RUNS = 400;

describe('fitting', () => {
  it('fits every item or the longest leading run that leaves room for the menu button', () => {
    const t = tally();
    fc.assert(fc.property(
      fc.array(fc.integer({ min: 0, max: 60 }), { maxLength: 8 }), fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 300 }), fc.nat({ max: 8 }), fc.boolean(),
      (sizes, more, size, gap, unmeasured) => {
        const keys = sizes.map((_, i) => `k${i}`);
        const map = new Map(keys.map((k, i) => [k, sizes[i]!]));
        if (unmeasured && keys.length) map.delete(keys[0]!);
        const n = fitting(keys, map, more, { size, gap });
        if (unmeasured && keys.length) { expect(n).toBe(Infinity); t.count('unmeasured'); return; }
        const all = sizes.reduce((s, v, i) => s + v + (i ? gap : 0), 0);
        if (all <= size + 0.5) { expect(n).toBe(Infinity); t.count('all'); return; }
        const used = (k: number) => more + sizes.slice(0, k).reduce((s, v) => s + v + gap, 0);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThan(keys.length);
        if (n > 0) expect(used(n)).toBeLessThanOrEqual(size + 0.5);
        expect(used(n + 1)).toBeGreaterThan(size + 0.5);
        t.count('some');
      }), runs(RUNS));
    for (const k of ['unmeasured', 'all', 'some']) t.atLeast(k, 50);
  }, timeoutFor(RUNS, 1));
});
