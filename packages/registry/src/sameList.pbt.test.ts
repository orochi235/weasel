/**
 * Property tests of `sameList`: it agrees with an index-by-index oracle under `===` and under a given `same`, never
 * calls `same` past the shorter list, and reads a list as the same as itself and any copy.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { sameList } from './sameList';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 500;
const item = fc.oneof(fc.integer({ min: 0, max: 2 }), fc.constantFrom<unknown>(NaN, -0, 0, '0', null, undefined));
const list = fc.array(item, { maxLength: 5 });
const pair = fc.oneof(fc.tuple(list, list), list.map((a) => [a, [...a]] as const), list.chain((a) => fc.tuple(fc.constant(a), fc.array(item, { minLength: a.length, maxLength: a.length }))));

describe('sameList', () => {
  it('agrees with an index-by-index comparison, under === and under Object.is', () => {
    const t = tally();
    fc.assert(fc.property(pair, ([a, b]) => {
      const strict = a.length === b.length && a.every((x, i) => x === b[i]);
      expect(sameList(a, b)).toBe(strict);
      const asked: number[] = [];
      const byIs = sameList(a, b, (x, y) => { asked.push(asked.length); return Object.is(x, y); });
      expect(byIs).toBe(a.length === b.length && a.every((x, i) => Object.is(x, b[i])));
      expect(asked.length).toBeLessThanOrEqual(a.length === b.length ? a.length : 0);
      t.count(strict ? 'same' : 'differ');
    }), runs(RUNS));
    t.atLeast('same', RUNS / 6);
    t.atLeast('differ', RUNS / 6);
  }, timeoutFor(RUNS, 1));

  it('reads a list as the same as itself without asking `same`', () => {
    fc.assert(fc.property(list, (a) => {
      expect(sameList(a, a, () => false)).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});
