/**
 * Property tests of the tree helpers on random forests: `holderOf` is the nearest selected id on the way to the root,
 * and `outermost` keeps exactly the ids no other selected id holds, in their order, holds every node the full list
 * holds, is idempotent, and hands back the list itself when it drops nothing.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { holderOf, outermost, type ParentOf } from './tree';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 400;
const N = 10;

/** A forest of nodes 0..N-1, each one's parent an earlier node or none; ids are numbers so 0 tests the `!= null` walk. */
const forest = fc.array(fc.option(fc.nat(), { freq: 3 }), { minLength: N, maxLength: N })
  .map((ps) => ps.map((p, i) => (p === null || i === 0 ? null : p % i)));
const parentOfIn = (ps: readonly (number | null)[]): ParentOf<number> => (id) => ps[id] ?? undefined;

const ancestors = (ps: readonly (number | null)[], id: number): number[] => {
  const out: number[] = [];
  for (let at = ps[id]; at != null; at = ps[at]) out.push(at);
  return out;
};

describe('holderOf', () => {
  it('is the id itself when selected, else its nearest selected ancestor, else null', () => {
    const t = tally();
    fc.assert(fc.property(forest, fc.subarray([...Array(N).keys()]), fc.nat(N - 1), (ps, sel, id) => {
      const selected = new Set(sel);
      const want = selected.has(id) ? id : ancestors(ps, id).find((a) => selected.has(a)) ?? null;
      expect(holderOf(selected, id, parentOfIn(ps))).toBe(want);
      t.count(want === null ? 'free' : want === id ? 'itself' : 'ancestor');
    }), runs(RUNS));
    t.atLeast('ancestor', RUNS / 40);
    t.atLeast('free', RUNS / 10);
  }, timeoutFor(RUNS, 1));
});

describe('outermost', () => {
  it('keeps the ids no other listed id holds, in order, and covers what the list covers', () => {
    const t = tally();
    fc.assert(fc.property(forest, fc.shuffledSubarray([...Array(N).keys()]), (ps, ids) => {
      const parentOf = parentOfIn(ps);
      const kept = outermost(ids, parentOf);
      const listed = new Set(ids);
      expect(kept).toEqual(ids.filter((id) => !ancestors(ps, id).some((a) => listed.has(a))));
      const all = new Set(ids), out = new Set(kept);
      for (let id = 0; id < N; id++) expect(holderOf(out, id, parentOf) !== null).toBe(holderOf(all, id, parentOf) !== null);
      for (const a of kept) for (const b of kept) if (a !== b) expect(ancestors(ps, b)).not.toContain(a);
      expect(outermost(kept, parentOf)).toBe(kept);
      if (kept.length === ids.length) expect(kept).toBe(ids);
      t.count(kept.length < ids.length ? 'dropped' : 'kept all');
    }), runs(RUNS));
    t.atLeast('dropped', RUNS / 5);
    t.atLeast('kept all', RUNS / 10);
  }, timeoutFor(RUNS, 2));
});
