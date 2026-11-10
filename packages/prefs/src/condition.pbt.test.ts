import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  isPrefCondition, mapPrefConditionPaths, ORDERINGS, prefConditionHolds, prefConditionPaths, type PrefCondition, type PrefConditionValue, type PrefTest,
} from './condition';
import { runs, tally, timeoutFor } from './pbt.fixture';

const PATHS = ['a', 'b', 'c.d'];
const value = fc.constantFrom<PrefConditionValue>(null, true, false, 0, 1, 2, -1, '', 'x', 'y');
const held = fc.constantFrom<unknown>(undefined, null, true, false, 0, 1, 2, -1, 0.5, '', 'x', 'y', [], [1], {}, { k: 1 });

const test: fc.Arbitrary<PrefTest> = fc.record({
  path: fc.constantFrom(...PATHS),
  from: fc.constantFrom(undefined, 'item' as const),
  is: fc.option(value, { nil: undefined, freq: 3 }),
  isNot: fc.option(value, { nil: undefined, freq: 3 }),
  in: fc.option(fc.array(value, { maxLength: 3 }), { nil: undefined, freq: 3 }),
  above: fc.option(fc.integer({ min: -2, max: 2 }), { nil: undefined, freq: 4 }),
  atMost: fc.option(fc.integer({ min: -2, max: 2 }), { nil: undefined, freq: 4 }),
}, { requiredKeys: ['path'] }).map((t) => Object.fromEntries(Object.entries(t).filter(([, v]) => v !== undefined)) as unknown as PrefTest);

const condition: fc.Arbitrary<PrefCondition> = fc.letrec<{ c: PrefCondition }>((tie) => ({
  c: fc.oneof(
    { depthSize: 'small' },
    test,
    fc.array(tie('c'), { maxLength: 3 }).map((all) => ({ all })),
    fc.array(tie('c'), { maxLength: 3 }).map((any) => ({ any })),
    tie('c').map((not) => ({ not })),
  ),
})).c;

const values = fc.record({ root: fc.dictionary(fc.constantFrom(...PATHS), held), item: fc.dictionary(fc.constantFrom(...PATHS), held) });

describe('prefs conditions, properties', () => {
  it('combines as boolean logic, and a test of several operators holds while each of them alone does', () => {
    const t = tally();
    fc.assert(
      fc.property(condition, values, (c, { root, item }) => {
        const read = (path: string, from?: 'item') => (from === 'item' ? item : root)[path];
        const holds = (x: PrefCondition): boolean => prefConditionHolds(x, read);
        expect(isPrefCondition(c)).toBe(true);
        t.count(holds(c) ? 'holds' : 'fails');
        expect(holds({ not: c })).toBe(!holds(c));
        expect(holds({ all: [c, c] })).toBe(holds(c));
        expect(holds({ any: [] })).toBe(false);
        expect(holds({ all: [] })).toBe(true);
        expect(holds({ any: [c, { not: c }] })).toBe(true);
        if ('path' in c) {
          const ops = (['is', 'isNot', 'in', ...ORDERINGS] as const).filter((op) => c[op] !== undefined);
          if (ops.length > 1) {
            t.count('several');
            expect(holds(c)).toBe(ops.every((op) => holds({ path: c.path, from: c.from, [op]: c[op] } as PrefTest)));
          }
        }
      }),
      runs(500),
    );
    t.atLeast('holds', 50);
    t.atLeast('fails', 50);
    t.atLeast('several', 30);
  }, timeoutFor(500, 1));

  it('moves every path it reads, keeping the condition itself where nothing moves', () => {
    fc.assert(
      fc.property(condition, fc.constantFrom('', 'x.'), (c, prefix) => {
        const moved = mapPrefConditionPaths(c, (path) => `${prefix}${path}`);
        if (prefix === '') expect(moved).toBe(c);
        for (const from of [undefined, 'item' as const]) {
          expect(prefConditionPaths(moved, from)).toEqual(prefConditionPaths(c, from).map((p) => `${prefix}${p}`));
        }
        expect(prefConditionHolds(moved, (path, from) => (path.startsWith(prefix) ? `${from}:${path.slice(prefix.length)}` : undefined)))
          .toBe(prefConditionHolds(c, (path, from) => `${from}:${path}`));
      }),
      runs(300),
    );
  }, timeoutFor(300, 1));
});
