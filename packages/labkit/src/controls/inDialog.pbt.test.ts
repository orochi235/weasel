/**
 * Properties of the one-line summary a dialog row shows of a compound leaf's value: it is the summary of each part,
 * a number with a unit written as its own field writes it, and every key of a map or an object kept, keys every
 * object inherits among them.
 */
import type { PrefLeaf } from '@weasel-js/prefs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KEYS, own, runs, tally, timeoutFor } from '../pbt.fixture';
import { summarizeLeaf, summarizeValue } from './inDialog';

const RUNS = 200;

const deg = { scale: Math.PI / 180, precision: 0, suffix: '°' };
const angle = { kind: 'number', name: 'Angle', description: '', default: 0, unit: deg } as const;
const plain = { kind: 'number', name: 'Count', description: '', default: 0 } as const;
const item = fc.constantFrom<PrefLeaf>(angle, plain);
const value = fc.oneof(
  fc.integer({ min: -720, max: 720 }),
  fc.double({ min: -10, max: 10, noNaN: true }),
);

/** What one number reads as on its own row. */
const one = (leaf: PrefLeaf, v: number): unknown => {
  const text = summarizeLeaf(leaf, v);
  return leaf === plain ? v : text;
};

describe("a compound leaf's summary", () => {
  it(
    "of a map is each entry's own summary under its own key",
    () => {
      const t = tally();
      fc.assert(
        fc.property(
          item,
          fc.uniqueArray(fc.tuple(fc.constantFrom(...KEYS), value), {
            selector: ([k]) => k,
            maxLength: 5,
          }),
          (leaf, entries) => {
            const map = {
              kind: 'map',
              name: 'Named',
              description: '',
              default: {},
              item: leaf,
            } as PrefLeaf;
            const got = summarizeLeaf(map, own(entries));
            const want = own(entries.map(([k, v]) => [k, one(leaf, v)] as const));
            expect(got).toBe(summarizeValue(want));
            if (entries.length > 0)
              expect(Object.keys(JSON.parse(got))).toEqual(entries.map(([k]) => k));
            if (entries.some(([k]) => k === '__proto__')) t.count('__proto__');
          },
        ),
        runs(RUNS),
      );
      t.atLeast('__proto__', RUNS / 10);
    },
    timeoutFor(RUNS, 2),
  );

  it(
    "of a list is each entry's own summary, in order",
    () => {
      fc.assert(
        fc.property(item, fc.array(value, { minLength: 1, maxLength: 5 }), (leaf, list) => {
          const l = {
            kind: 'list',
            name: 'Stops',
            description: '',
            default: [],
            item: leaf,
          } as PrefLeaf;
          expect(summarizeLeaf(l, list)).toBe(list.map((v) => summarizeLeaf(leaf, v)).join(', '));
        }),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 2),
  );

  it(
    'of an object writes its fields by their own leaves and keeps every other key as it is',
    () => {
      fc.assert(
        fc.property(
          fc.uniqueArray(fc.tuple(fc.constantFrom(...KEYS), value), {
            selector: ([k]) => k,
            maxLength: 5,
          }),
          fc.subarray([...KEYS]),
          (entries, fieldKeys) => {
            const children = own(fieldKeys.map((k) => [k, angle] as const));
            const object = {
              kind: 'object',
              name: 'Arc',
              description: '',
              default: {},
              children,
            } as PrefLeaf;
            const want = own(
              entries.map(
                ([k, v]) =>
                  [k, fieldKeys.includes(k as never) ? summarizeLeaf(angle, v) : v] as const,
              ),
            );
            expect(summarizeLeaf(object, own(entries))).toBe(summarizeValue(want));
          },
        ),
        runs(RUNS),
      );
    },
    timeoutFor(RUNS, 2),
  );
});
