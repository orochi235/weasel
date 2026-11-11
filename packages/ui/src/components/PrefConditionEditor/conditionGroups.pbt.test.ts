/**
 * Property tests of how the condition editor draws a condition as groups of rows: a condition read as a group, or
 * as a root group with rows, and written back holds exactly when the original does, under every truth of its
 * tests; an empty group comes to what its quantifier says of nothing.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { PrefCondition, PrefTest } from '@weasel-js/prefs';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { EMPTY_HOLDS, groupCondition, groupOf, rootCondition, rootGroup, rowCondition, testRowOf, type Quantifier } from './conditionGroups';

const RUNS = 400;
const TESTS = 4;

const test = fc.nat({ max: TESTS - 1 }).map((i) => ({ path: `t${i}`, equals: true }) as unknown as PrefTest);
const condition = fc.letrec<{ c: PrefCondition }>((tie) => ({
  c: fc.oneof({ depthSize: 'small' },
    { arbitrary: test as fc.Arbitrary<PrefCondition>, weight: 3 },
    { arbitrary: tie('c').map((c) => ({ not: c }) as PrefCondition), weight: 2 },
    { arbitrary: fc.array(tie('c'), { maxLength: 3 }).map((all) => ({ all }) as PrefCondition), weight: 1 },
    { arbitrary: fc.array(tie('c'), { maxLength: 3 }).map((any) => ({ any }) as PrefCondition), weight: 1 }),
})).c;

function holds(c: PrefCondition | undefined, truth: readonly boolean[]): boolean {
  if (c === undefined) return true;
  if ('not' in c) return !holds(c.not, truth);
  if ('all' in c) return c.all.every((p) => holds(p, truth));
  if ('any' in c) return c.any.some((p) => holds(p, truth));
  return truth[Number((c as unknown as { path: string }).path.slice(1))]!;
}

/** Every assignment of truth to the tests. */
const truths = Array.from({ length: 1 << TESTS }, (_, m) => Array.from({ length: TESTS }, (_, i) => ((m >> i) & 1) === 1));
const same = (a: PrefCondition | undefined, b: PrefCondition | undefined) => {
  for (const t of truths) expect(holds(a, t)).toBe(holds(b, t));
};

describe('condition groups', () => {
  it('write a condition back from its group, and from its root group, holding exactly when it does', () => {
    const t = tally();
    fc.assert(fc.property(condition, (c) => {
      const g = groupOf(c);
      same(groupCondition(g), c);
      // A root with no rows is no condition, as rootCondition's doc says, whatever its quantifier.
      if (rootGroup(c).parts.length > 0) same(rootCondition(rootGroup(c)), c);
      else t.count('empty root');
      t.count(g.quantifier);
      const row = testRowOf(c);
      if (row) { same(rowCondition(row), c); t.count(row.negated ? 'negated row' : 'row'); }
    }), runs(RUNS));
    for (const k of ['all', 'any', 'none', 'notAll', 'row', 'negated row', 'empty root']) t.atLeast(k, 20);
  }, timeoutFor(RUNS, 2));

  it('come to what the quantifier says of nothing when empty, and of the parts otherwise', () => {
    fc.assert(fc.property(fc.constantFrom<Quantifier>('all', 'any', 'none', 'notAll'), fc.array(condition, { maxLength: 3 }), (q, parts) => {
      const c = groupCondition({ quantifier: q, parts });
      for (const truth of truths) {
        const each = parts.map((p) => holds(p, truth));
        const want = parts.length === 0 ? EMPTY_HOLDS[q]
          : q === 'all' ? each.every(Boolean) : q === 'any' ? each.some(Boolean) : q === 'none' ? !each.some(Boolean) : !each.every(Boolean);
        expect(holds(c, truth)).toBe(want);
      }
      expect(rootCondition({ quantifier: q, parts: [] })).toBeUndefined();
    }), runs(RUNS));
    expect(rootGroup(undefined)).toEqual({ quantifier: 'all', parts: [] });
  }, timeoutFor(RUNS, 2));
});
