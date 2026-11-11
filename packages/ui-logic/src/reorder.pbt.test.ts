/**
 * Property tests of reordering: `moveItems` against a plain take-out-and-put-back model, `movedIndex` naming where
 * the moved run starts, `isNoopDrop` exactly when a drop changes nothing, nudges moving a run by one place, and
 * the gap pickers.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { gapByMidpoint, isNoopDrop, moveItems, movedIndex, nearestGap, nudgeGap } from './reorder';

const RUNS = 400;

/** A list of distinct items, some indices into it (and past it), and a gap (and past either end). */
const drop = fc.integer({ min: 0, max: 8 }).chain((n) => fc.record({
  items: fc.constant(Array.from({ length: n }, (_, i) => `i${i}`)),
  at: fc.array(fc.integer({ min: -2, max: n + 1 }), { maxLength: 5 }),
  to: fc.integer({ min: -2, max: n + 2 }),
}));

function model(items: readonly string[], at: readonly number[], to: number): string[] {
  const picked = items.filter((_, i) => at.includes(i));
  const gap = Math.min(items.length, Math.max(0, to));
  const before = items.slice(0, gap).filter((it) => !picked.includes(it));
  const after = items.slice(gap).filter((it) => !picked.includes(it));
  return [...before, ...picked, ...after];
}

describe('moveItems', () => {
  it('takes the named items out and puts them back, in order, at the gap', () => {
    const t = tally();
    fc.assert(fc.property(drop, ({ items, at, to }) => {
      const got = moveItems(items, at, to);
      expect(got).toEqual(model(items, at, to));
      const inside = [...new Set(at)].filter((i) => i >= 0 && i < items.length);
      if (inside.length > 0) {
        const gap = Math.min(items.length, Math.max(0, to));
        expect(got.indexOf(items[Math.min(...inside)]!)).toBe(movedIndex(inside, gap));
      }
      const same = got.every((it, i) => it === items[i]);
      if (inside.length > 0 && to >= 0 && to <= items.length) {
        expect(isNoopDrop(inside, to)).toBe(same);
        t.count(same ? 'noop' : 'moved');
      }
    }), runs(RUNS));
    t.atLeast('noop', RUNS / 20);
    t.atLeast('moved', RUNS / 8);
  }, timeoutFor(RUNS, 3));

  it('nudges a run one place along, or nowhere at an end', () => {
    const t = tally();
    fc.assert(fc.property(drop, fc.constantFrom<-1 | 1>(-1, 1), ({ items, at }, by) => {
      const inside = [...new Set(at)].filter((i) => i >= 0 && i < items.length);
      const gap = nudgeGap(inside, by, items.length);
      if (inside.length === 0) { expect(gap).toBeNull(); return; }
      const lo = Math.min(...inside);
      const hi = Math.max(...inside);
      if (by < 0 ? lo === 0 : hi === items.length - 1) { expect(gap).toBeNull(); t.count('end'); return; }
      expect(gap).not.toBeNull();
      const got = moveItems(items, inside, gap!);
      const start = got.indexOf(items[lo]!);
      // The run lands one place past where its first item stood, going up, or ends one place past its last.
      if (by < 0) expect(start).toBe(lo - 1);
      else expect(start + inside.length - 1).toBe(hi + 1);
      t.count('nudged');
    }), runs(RUNS));
    t.atLeast('nudged', RUNS / 4);
    t.atLeast('end', RUNS / 20);
  }, timeoutFor(RUNS, 3));
});

describe('gap pickers', () => {
  it('gapByMidpoint counts the middles reached, either way along the line', () => {
    fc.assert(fc.property(
      fc.uniqueArray(fc.integer({ min: -100, max: 100 }), { maxLength: 8 }).map((m) => m.sort((a, b) => a - b)),
      fc.integer({ min: -120, max: 120 }), fc.boolean(),
      (mids, p, backward) => {
        const line = backward ? [...mids].reverse() : mids;
        const got = gapByMidpoint(line, p);
        expect(got).toBeGreaterThanOrEqual(0);
        expect(got).toBeLessThanOrEqual(mids.length);
        const forwardGap = mids.filter((m) => m <= p).length;
        if (mids.length > 1) expect(got).toBe(backward ? mids.filter((m) => m >= p).length : forwardGap);
      },
    ), runs(RUNS));
  }, timeoutFor(RUNS, 3));

  it('nearestGap picks a gap no farther than any other, and -1 for none', () => {
    fc.assert(fc.property(fc.array(fc.double({ min: -1e6, max: 1e6, noNaN: true }), { maxLength: 8 }), fc.double({ min: -1e6, max: 1e6, noNaN: true }), (gaps, p) => {
      const k = nearestGap(gaps, p);
      if (gaps.length === 0) { expect(k).toBe(-1); return; }
      for (const g of gaps) expect(Math.abs(gaps[k]! - p)).toBeLessThanOrEqual(Math.abs(g - p));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 3));
});
