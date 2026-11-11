/**
 * Property tests of the band list: a partition of `[min, max]` that every split, merge, and lock keeps, and
 * `scaleEdges`, which rescales the range with locked bands held to their lengths.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { linearScale } from '@weasel-js/plot/scales';
import { runs, tally, timeoutFor, uniform } from '../../pbt.fixture';
import { bandBounds, edgeReach, mergeBand, normalizeBands, scaleEdges, splitBands, toggleLock, unitEdges, type Band } from './bands';

const RUNS = 300;

/** A partition of `[min, max]` into up to six bands, seams sorted and possibly coincident. */
const partition = fc.record({
  min: fc.oneof(uniform(-100, 100), fc.constantFrom(0, -1)),
  span: fc.oneof(uniform(0.001, 1000), fc.constantFrom(1, 10)),
  cuts: fc.array(fc.oneof(uniform(0, 1), fc.constantFrom(0, 0.5, 1)), { maxLength: 5 }),
  locks: fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }),
}).map(({ min, span, cuts, locks }) => {
  const max = min + span;
  const seams = [...cuts].sort((a, b) => a - b).map((f) => min + f * span);
  const bands: Band<string>[] = [min, ...seams].map((from, i) => ({ from, data: `b${i}`, ...(locks[i] ? { locked: true } : {}) }));
  return { min, max, bands };
});

const tiles = (bands: readonly Band<string>[], min: number, max: number): void => {
  let at = min;
  for (let i = 0; i < bands.length; i++) {
    const [from, to] = bandBounds(bands, i, min, max);
    expect(from).toBe(at);
    expect(to).toBeGreaterThanOrEqual(from);
    at = to;
  }
  expect(at).toBe(max);
};

describe('band edits', () => {
  it('split a band strictly inside it, else hand back the list', () => {
    const t = tally();
    fc.assert(fc.property(partition, fc.oneof(uniform(-0.2, 1.2), fc.constantFrom(0, 1)), ({ min, max, bands }, f) => {
      const at = f < 0.5 && bands.length > 1 && f > 0.4 ? bands[1]!.from : min + f * (max - min);
      const out = splitBands(bands, at, min, max, (_, from) => `${from}+`);
      const inside = bands.findIndex((_, i) => { const [a, b] = bandBounds(bands, i, min, max); return at > a && at < b; });
      if (inside < 0) { expect(out).toBe(bands); t.count('none'); return; }
      t.count('split');
      expect(out).toHaveLength(bands.length + 1);
      expect(out[inside + 1]).toEqual({ from: at, data: `${bands[inside]!.data}+` });
      expect(out.filter((_, i) => i !== inside + 1)).toEqual(bands);
      tiles(out, min, max);
    }), runs(RUNS));
    t.atLeast('none', 20);
    t.atLeast('split', 50);
  }, timeoutFor(RUNS, 2));

  it('merge a band into its left neighbor, never the first, and lock and unlock back to where it began', () => {
    const t = tally();
    fc.assert(fc.property(partition, fc.integer({ min: -1, max: 7 }), ({ min, max, bands }, i) => {
      const merged = mergeBand(bands, i);
      if (i <= 0 || i >= bands.length) expect(merged).toBe(bands);
      else {
        t.count('merged');
        expect(merged).toEqual(bands.filter((_, k) => k !== i));
        tiles(merged, min, max);
        const [a] = bandBounds(bands, i - 1, min, max);
        expect(bandBounds(merged, i - 1, min, max)).toEqual([a, bandBounds(bands, i, min, max)[1]]);
      }
      const locked = toggleLock(bands, i);
      if (bands[i] === undefined) { expect(locked).toBe(bands); return; }
      t.count('locked');
      expect(!!locked[i]!.locked).toBe(!bands[i]!.locked);
      expect(toggleLock(locked, i)).toEqual(bands);
    }), runs(RUNS));
    t.atLeast('merged', 50);
    t.atLeast('locked', 50);
  }, timeoutFor(RUNS, 2));

  it('normalize the first start onto min and keep a partition tiled', () => {
    fc.assert(fc.property(partition, uniform(-5, 5), ({ min, max, bands }, off) => {
      const moved = bands.map((b, i) => (i === 0 ? { ...b, from: b.from + off } : b));
      const out = normalizeBands(moved, min);
      expect(out[0]!.from).toBe(min);
      tiles(out, min, max);
      const edges = unitEdges(out, linearScale, min, max);
      expect(edges).toHaveLength(out.length + 1);
      expect(edges[0]).toBe(0);
      expect(edges.at(-1)).toBe(1);
      for (let i = 1; i < edges.length; i++) expect(edges[i]!).toBeGreaterThanOrEqual(edges[i - 1]!);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});

/** Track edges and locks from a partition, as `BandEditor` hands them to `scaleEdges`. */
const track = fc.tuple(partition, fc.boolean()).map(([{ bands, min, max }, squeeze]) => {
  const locked = bands.map((b) => !!b.locked);
  const edges = unitEdges(bands, linearScale, min, max);
  if (!squeeze) return { edges, locked };
  // Every free band emptied, so a rescale has no lengths to share in proportion.
  const lens = locked.map((l, i) => (l ? edges[i + 1]! - edges[i]! : 0));
  const squeezed = [0];
  for (const len of lens) squeezed.push(squeezed.at(-1)! + len);
  return squeezed.at(-1)! > 0 ? { edges: squeezed, locked } : { edges, locked };
}).chain((tr) => fc.record({
  tr: fc.constant(tr),
  edge: fc.constantFrom<'min' | 'max'>('min', 'max'),
  to: fc.oneof(uniform(-2, 3), fc.constantFrom(0, 1)),
  limits: fc.option(fc.tuple(uniform(-2, 0), uniform(1, 3)), { nil: undefined }),
}));

describe('scaleEdges', () => {
  it('holds the other end and every locked length, scales the free bands alike, and stays within reach', () => {
    const t = tally();
    fc.assert(fc.property(track, ({ tr: { edges, locked }, edge, to, limits }) => {
      const n = edges.length - 1;
      const [lo, hi] = edgeReach(edges, locked, edge, limits);
      expect(lo).toBeLessThanOrEqual(hi);
      const out = scaleEdges(edges, locked, edge, to, limits);
      if (out === null) {
        t.count('collapsed');
        const at = Math.max(lo, Math.min(hi, to));
        expect(edge === 'min' ? edges[n]! - at : at - edges[0]!).toBeLessThanOrEqual(0);
        return;
      }
      if (out === edges) { t.count('unchanged'); return; }
      t.count('scaled');
      expect(out).toHaveLength(edges.length);
      for (const v of out) expect(Number.isFinite(v)).toBe(true);
      if (edge === 'min') { expect(out[n]).toBe(edges[n]); expect(out[0]! >= lo && out[0]! <= hi).toBe(true); }
      else { expect(out[0]).toBe(edges[0]); expect(out[n]! >= lo && out[n]! <= hi).toBe(true); }
      for (let i = 0; i < n; i++) {
        const len = out[i + 1]! - out[i]!;
        expect(len).toBeGreaterThanOrEqual(-1e-12);
        if (locked[i]) expect(len).toBeCloseTo(edges[i + 1]! - edges[i]!, 9);
      }
      const free = [...Array(n).keys()].filter((i) => !locked[i] && edges[i + 1]! > edges[i]!);
      const empty = [...Array(n).keys()].filter((i) => !locked[i]);
      if (free.length === 0 && empty.length > 0) {
        t.count('shared equally');
        for (const i of empty) expect(out[i + 1]! - out[i]!).toBeCloseTo(out[empty[0]! + 1]! - out[empty[0]!]!, 9);
      }
      if (free.length > 1) {
        t.count('ratio');
        const ratio = (i: number) => (out[i + 1]! - out[i]!) / (edges[i + 1]! - edges[i]!);
        for (const i of free) expect(ratio(i)).toBeCloseTo(ratio(free[0]!), 6);
      }
    }), runs(RUNS));
    t.atLeast('scaled', 50);
    t.atLeast('ratio', 30);
    t.atLeast('collapsed', 5);
    t.atLeast('shared equally', 10);
  }, timeoutFor(RUNS, 2));

  it('hands back the edges themselves for a move to where the edge already is', () => {
    fc.assert(fc.property(track, ({ tr: { edges, locked }, edge }) => {
      const at = edge === 'min' ? edges[0]! : edges.at(-1)!;
      expect(scaleEdges(edges, locked, edge, at)).toBe(edges);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('scaleEdges, shrunk', () => {
  it('leaves a range of locked bands where it is when its edge does not move', () => {
    const edges = [0, 0.2239799499511717, 0.8581094741821288, 1];
    expect(scaleEdges(edges, [true, true, true], 'min', 0)).toBe(edges);
    expect(edgeReach(edges, [true, true, true], 'min')).toEqual([0, 0]);
  });
});
