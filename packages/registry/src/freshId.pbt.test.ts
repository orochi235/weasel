/**
 * Property tests of `freshId`: the id it gives is never taken, is the first free one counting from `from`, and,
 * fed back into the set, never repeats over a run of calls, `from` past 2^53 included.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { freshId } from './freshId';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 300;
const base = fc.constantFrom('a', 'a-1', 'node', '', '-');
const sep = fc.option(fc.constantFrom('-', '_', '', '-1'), { nil: undefined });
const from = fc.option(fc.oneof(
  fc.integer({ min: -3, max: 3 }),
  fc.constantFrom(0.5, NaN, Infinity, 2 ** 53 - 2, 2 ** 53, 1e20, -1e20, -(2 ** 53)),
), { nil: undefined });

describe('freshId', () => {
  it('never repeats an id taken, over a run of calls each fed back into the set', () => {
    const t = tally();
    fc.assert(fc.property(base, sep, from, fc.boolean(), fc.array(fc.string({ maxLength: 4 }), { maxLength: 4 }), fc.integer({ min: 1, max: 12 }),
      (b, s, f, bare, seed, count) => {
        const taken = new Set(seed);
        for (let i = 0; i < count; i++) {
          const id = freshId(b, taken, { from: f, sep: s, bare });
          expect(taken.has(id)).toBe(false);
          taken.add(id);
        }
        t.count(f !== undefined && Math.abs(f) >= 2 ** 53 ? 'past 2^53' : 'small');
      }), runs(RUNS));
    t.atLeast('past 2^53', RUNS / 10);
    t.atLeast('small', RUNS / 4);
  }, timeoutFor(RUNS, 2));

  it('gives the first free id counting up from `from`', () => {
    const t = tally();
    fc.assert(fc.property(fc.integer({ min: -5, max: 5 }), fc.uniqueArray(fc.integer({ min: -5, max: 12 }), { minLength: 4, maxLength: 14 }), fc.boolean(), (f, nums, bare) => {
      const taken = new Set(nums.map((n) => (n === 12 ? 'x' : `x-${n}`)));
      let want = bare && !taken.has('x') ? 'x' : null;
      for (let n = f; want === null; n++) if (!taken.has(`x-${n}`)) want = `x-${n}`;
      expect(freshId('x', taken, { from: f, bare })).toBe(want);
      t.count(want === `x-${f}` || want === 'x' ? 'first' : 'skipped');
    }), runs(RUNS));
    t.atLeast('skipped', RUNS / 6);
  }, timeoutFor(RUNS, 1));
});

describe('freshId, shrunk', () => {
  it('steps past a taken id at 1e20, where adding one changes nothing', () => {
    expect(freshId('a', new Set(['a-100000000000000000000']), { from: 1e20 })).toBe('a-100000000000000020000');
  });

  it('refuses to count past the largest number, rather than loop', () => {
    expect(() => freshId('a', { has: () => true }, { from: Number.MAX_VALUE })).toThrow(RangeError);
  });
});
