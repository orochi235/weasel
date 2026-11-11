/**
 * Properties of how chrome contributions combine: bundles merged in order with `start` ones first and a duplicate id
 * refused, ids suppressed with a typo refused, and a region's contributions bucketed into runs by group, each run
 * told apart from every other.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { KEYS, runs, tally, timeoutFor } from '../pbt.fixture';
import { mergeContributions, suppressContributions } from './merge';
import { groupsOf } from './regions/groupsOf';
import type { ContributionBase } from './types';

const RUNS = 300;

const id = fc.constantFrom(...KEYS, 'zoom', 'tools');
const entry = fc.record(
  {
    id,
    start: fc.boolean(),
    group: fc.constantFrom('zoom', 'tools', 'toString', ''),
    end: fc.boolean(),
  },
  { requiredKeys: ['id'] },
);
const bundles = fc.array(fc.array(entry, { maxLength: 4 }), { maxLength: 4 });

describe('merging contributions', () => {
  it(
    "keeps every bundle's entries in order, the ones marked start first, and refuses an id named twice",
    () => {
      const t = tally();
      fc.assert(
        fc.property(bundles, (bs) => {
          const all = bs.flat();
          const ids = all.map((c) => c.id);
          if (new Set(ids).size < ids.length) {
            t.count('duplicate');
            expect(() => mergeContributions(...bs)).toThrow(/duplicate contribution id/);
            return;
          }
          t.count('merged');
          expect(mergeContributions(...bs)).toEqual([
            ...all.filter((c) => c.start),
            ...all.filter((c) => !c.start),
          ]);
        }),
        runs(RUNS),
      );
      t.atLeast('duplicate', RUNS / 10);
      t.atLeast('merged', RUNS / 10);
    },
    timeoutFor(RUNS, 1),
  );

  it(
    'suppresses exactly the ids named, in place, and refuses one that is absent unless it is transient',
    () => {
      const t = tally();
      fc.assert(
        fc.property(
          fc.uniqueArray(entry, { selector: (c) => c.id, maxLength: 6 }),
          fc.array(id, { maxLength: 3 }),
          fc.uniqueArray(id, { maxLength: 2 }),
          (bundle, drop, transient) => {
            const present = new Set(bundle.map((c) => c.id));
            const run = () => suppressContributions(bundle, drop, new Set(transient));
            if (drop.some((d) => !present.has(d) && !transient.includes(d))) {
              t.count('refused');
              expect(run).toThrow(/cannot suppress/);
              return;
            }
            t.count('suppressed');
            expect(run()).toEqual(bundle.filter((c) => !drop.includes(c.id)));
          },
        ),
        runs(RUNS),
      );
      t.atLeast('refused', RUNS / 10);
      t.atLeast('suppressed', RUNS / 10);
    },
    timeoutFor(RUNS, 1),
  );
});

describe("a region's runs", () => {
  it(
    'hold each group together where it first appears, keep each ungrouped entry in place, and are each told apart',
    () => {
      const t = tally();
      fc.assert(
        fc.property(fc.uniqueArray(entry, { selector: (c) => c.id, maxLength: 7 }), (list) => {
          const runs = groupsOf(list as ContributionBase[]);
          // Model: walk the list, opening a run at an ungrouped entry or a group's first entry.
          const want: { group: string | undefined; ids: string[] }[] = [];
          for (const c of list) {
            const open = c.group === undefined ? undefined : want.find((w) => w.group === c.group);
            if (open) open.ids.push(c.id);
            else want.push({ group: c.group, ids: [c.id] });
          }
          expect(runs.map((r) => r.entries.map((c) => c.id))).toEqual(want.map((w) => w.ids));
          const told = runs.map((r) => r.id);
          expect(new Set(told).size).toBe(told.length);
          if (list.some((c) => c.group === undefined && list.some((d) => d.group === c.id)))
            t.count('id and group share a name');
        }),
        runs(RUNS),
      );
      t.atLeast('id and group share a name', RUNS / 20);
    },
    timeoutFor(RUNS, 1),
  );

  it('tell a group apart from an ungrouped contribution with its name (shrunk)', () => {
    const runs = groupsOf([{ id: 'zoom' }, { id: 'a', group: 'zoom' }] as ContributionBase[]);
    expect(runs.map((r) => r.key)).toEqual(['zoom', 'zoom']);
    expect(runs.map((r) => r.id)).toEqual(['entry:zoom', 'group:zoom']);
  });
});
