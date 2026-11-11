/**
 * `regionChanges` between two random standings of nested regions and pools. An unchanged standing reports nothing;
 * a region reports its box when it moved, resized, or changed parent (naming the new parent only then), unless it is
 * a pool's lane or a fitted container carried by a region around it; a pool reports its lanes when they changed.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { regionChanges, type RegionStanding } from './regionSync';

const RUNS = 400;

const IDS = ['P', 'A', 'B', 'C', 'D'];
const boxArb = fc.record({ x: fc.integer({ min: 0, max: 2 }), y: fc.constant(0), width: fc.integer({ min: 1, max: 2 }), height: fc.constant(10) });

/** A standing: each region inside one earlier in `IDS` or at the top, `P` a pool whose lanes are its children. */
const standingArb: fc.Arbitrary<RegionStanding> = fc.tuple(
  ...IDS.map((id, i) => fc.record({
    box: boxArb,
    parent: i === 0 ? fc.constant(null) : fc.option(fc.constantFrom(...IDS.slice(0, i)), { nil: null }),
    fitted: id === 'P' ? fc.constant(false) : fc.boolean(),
  })),
).map((ats) => {
  const regions = new Map(IDS.map((id, i) => [id, ats[i]!]));
  const lanes = IDS.filter((id) => regions.get(id)!.parent === 'P').map((id) => ({ id, size: regions.get(id)!.box.width }));
  return { regions, pools: new Map([['P', lanes]]) };
});

/** `was`, and `was` with some regions moved or reparented. */
const pairArb = standingArb.chain((was) => fc.tuple(fc.constant(was), fc.tuple(...IDS.map(() => fc.option(boxArb, { freq: 2 })), ...IDS.map((_, i) => (i === 0 ? fc.constant(undefined) : fc.option(fc.option(fc.constantFrom(...IDS.slice(0, i)), { nil: null }), { freq: 3, nil: undefined })))).map((edits) => {
  const regions = new Map([...was.regions].map(([id, at], i) => {
    const box = edits[i] as typeof at.box | null;
    const parent = edits[IDS.length + i] as string | null | undefined;
    return [id, { ...at, ...(box !== null ? { box } : {}), ...(parent !== undefined ? { parent } : {}) }];
  }));
  const lanes = IDS.filter((id) => regions.get(id)!.parent === 'P').map((id) => ({ id, size: regions.get(id)!.box.width }));
  return { regions, pools: new Map([['P', lanes]]) } as RegionStanding;
})));

const same = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => JSON.stringify(a) === JSON.stringify(b);

describe('regionChanges', () => {
  it('reports nothing for a standing against itself', () => {
    fc.assert(fc.property(standingArb, (s) => { expect(regionChanges(s, s)).toEqual([]); }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('reports each region that moved, once, and a pool whose lanes changed', () => {
    const seen = tally();
    fc.assert(fc.property(pairArb, ([was, now]) => {
      const out = regionChanges(was, now);
      const changed = IDS.filter((id) => !same(was.regions.get(id)!.box, now.regions.get(id)!.box) || was.regions.get(id)!.parent !== now.regions.get(id)!.parent);
      const carried = (id: string) => {
        for (let p = now.regions.get(id)!.parent; p !== null; p = now.regions.get(p)!.parent) if (changed.includes(p)) return true;
        return false;
      };
      const want = changed.filter((id) => {
        const at = now.regions.get(id)!;
        if (at.parent === 'P') return false;
        return !(at.fitted && was.regions.get(id)!.parent === at.parent && carried(id));
      });
      const boxes = out.filter((e) => e.kind === 'box');
      expect(boxes.map((e) => e.id).sort()).toEqual([...want].sort());
      for (const e of boxes) {
        const at = now.regions.get(e.id)!;
        expect(e.box).toEqual(at.box);
        const moved = was.regions.get(e.id)!.parent !== at.parent;
        expect('parent' in e).toBe(moved);
        if (moved) { expect(e.parent).toBe(at.parent); seen.count('reparented'); }
      }
      if (changed.some((id) => now.regions.get(id)!.parent === 'P')) seen.count('lane moved');
      if (changed.some((id) => !want.includes(id) && now.regions.get(id)!.parent !== 'P')) seen.count('carried');
      const lanesChanged = JSON.stringify(was.pools.get('P')) !== JSON.stringify(now.pools.get('P'));
      expect(out.filter((e) => e.kind === 'lanes')).toEqual(lanesChanged ? [{ kind: 'lanes', pool: 'P', lanes: now.pools.get('P') }] : []);
    }), runs(RUNS));
    seen.atLeast('reparented', RUNS / 4);
    seen.atLeast('lane moved', RUNS / 4);
    seen.atLeast('carried', RUNS / 20);
  }, timeoutFor(RUNS, 1));
});
