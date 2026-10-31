import { describe, it, expect } from 'vitest';
import {
  bandBounds,
  edgeReach,
  mergeBand,
  scaleEdges,
  normalizeBands,
  splitBands,
  toggleLock,
  unitEdges,
  type Band,
} from './bands';
import { linearScale } from '@weasel-js/plot/scales';

const MIN = 0;
const MAX = 100;

function fixture(): Band<string>[] {
  return [
    { from: 7, data: 'a' },
    { from: 20, data: 'b' },
    { from: 60, data: 'c' },
  ];
}

describe('normalizeBands', () => {
  it('pins the first band to min without touching the rest', () => {
    expect(normalizeBands(fixture(), MIN)).toEqual([
      { from: 0, data: 'a' },
      { from: 20, data: 'b' },
      { from: 60, data: 'c' },
    ]);
  });

  it('copies rather than mutating the caller value', () => {
    const value = fixture();
    normalizeBands(value, MIN);
    expect(value[0].from).toBe(7);
  });

  it('tolerates an empty list', () => {
    expect(normalizeBands([], MIN)).toEqual([]);
  });
});

describe('bandBounds', () => {
  it('spans min to max across the whole list, with no gaps', () => {
    const bands = normalizeBands(fixture(), MIN);
    expect(bandBounds(bands, 0, MIN, MAX)).toEqual([0, 20]);
    expect(bandBounds(bands, 1, MIN, MAX)).toEqual([20, 60]);
    expect(bandBounds(bands, 2, MIN, MAX)).toEqual([60, 100]);
  });
});

describe('unitEdges', () => {
  it('reads the band edges off as track positions from 0 to 1', () => {
    const bands = normalizeBands(fixture(), MIN);
    expect(unitEdges(bands, linearScale, MIN, MAX)).toEqual([0, 0.2, 0.6, 1]);
  });
});

describe('splitBands', () => {
  it('adds one band and duplicates the payload it split', () => {
    const bands = normalizeBands(fixture(), MIN);
    const next = splitBands(bands, 10, MIN, MAX, (_at, from) => from);
    expect(next).toHaveLength(4);
    expect(next.map((b) => b.from)).toEqual([0, 10, 20, 60]);
    expect(next.map((b) => b.data)).toEqual(['a', 'a', 'b', 'c']);
  });

  it('hands the split position and source payload to splitBand', () => {
    const bands = normalizeBands(fixture(), MIN);
    const next = splitBands(bands, 40, MIN, MAX, (at, from) => `${from}@${at}`);
    expect(next.map((b) => b.data)).toEqual(['a', 'b', 'b@40', 'c']);
  });

  it('splits the last band too', () => {
    const bands = normalizeBands(fixture(), MIN);
    expect(splitBands(bands, 80, MIN, MAX, (_at, from) => from).map((b) => b.from)).toEqual([
      0, 20, 60, 80,
    ]);
  });

  it('splits nothing on an existing seam or at either end of the axis', () => {
    const bands = normalizeBands(fixture(), MIN);
    for (const at of [MIN, MAX, 20, 60, -5, 500]) {
      expect(splitBands(bands, at, MIN, MAX, (_a, from) => from)).toBe(bands);
    }
  });
});

describe('mergeBand', () => {
  it('drops the band and keeps its left neighbour payload', () => {
    const bands = normalizeBands(fixture(), MIN);
    const next = mergeBand(bands, 1);
    expect(next).toHaveLength(2);
    expect(next.map((b) => b.data)).toEqual(['a', 'c']);
    // Band 'a' now runs to where 'b' used to end.
    expect(bandBounds(next, 0, MIN, MAX)).toEqual([0, 60]);
  });

  it('cannot merge away the first band — a partition has at least one part', () => {
    const bands = normalizeBands(fixture(), MIN);
    expect(mergeBand(bands, 0)).toBe(bands);
    expect(mergeBand([{ from: 0, data: 'only' }], 0)).toHaveLength(1);
  });

  it('ignores an out-of-range index', () => {
    const bands = normalizeBands(fixture(), MIN);
    expect(mergeBand(bands, 9)).toBe(bands);
  });
});

describe('toggleLock', () => {
  it('locks an unlocked band and unlocks a locked one', () => {
    const once = toggleLock(fixture(), 1);
    expect(once.map((b) => b.locked ?? false)).toEqual([false, true, false]);
    expect('locked' in toggleLock(once, 1)[1]).toBe(false);
  });
});

describe('edgeReach', () => {
  const edges = [0, 0.25, 0.75, 1];

  it('lets an end come inward until the unlocked bands vanish', () => {
    expect(edgeReach(edges, [false, true, false], 'max')).toEqual([0.5, Infinity]);
    expect(edgeReach(edges, [false, true, false], 'min', [-0.5, 2])).toEqual([-0.5, 0.5]);
  });

  it('pins both ends when every band is locked', () => {
    expect(edgeReach(edges, [true, true, true], 'max')).toEqual([1, 1]);
  });
});

describe('scaleEdges', () => {
  const edges = [0, 0.2, 0.6, 1];
  const round = (xs: readonly number[] | null) => xs?.map((x) => Math.round(x * 1e6) / 1e6);

  it('stretches every band in proportion when none is locked', () => {
    expect(round(scaleEdges(edges, [false, false, false], 'max', 2))).toEqual([0, 0.4, 1.2, 2]);
    expect(round(scaleEdges(edges, [false, false, false], 'min', 0.5))).toEqual([0.5, 0.6, 0.8, 1]);
  });

  it('holds a locked band at its length and gives the rest the difference', () => {
    expect(round(scaleEdges(edges, [false, true, false], 'max', 1.6))).toEqual([0, 0.4, 0.8, 1.6]);
  });

  it('stops where the unlocked bands vanish, and at the limits', () => {
    expect(round(scaleEdges(edges, [false, true, false], 'max', 0))).toEqual([0, 0, 0.4, 0.4]);
    expect(round(scaleEdges(edges, [false, false, false], 'max', 9, [-Infinity, 1.5]))).toEqual([0, 0.3, 0.9, 1.5]);
  });

  it('shares the change equally among unlocked bands that are all empty', () => {
    expect(round(scaleEdges([0, 0, 0.5, 0.5], [false, true, false], 'max', 1.5))).toEqual([0, 0.5, 1, 1.5]);
  });

  it('returns the edges it was given for no change, and null for a collapse to a point', () => {
    expect(scaleEdges(edges, [false, false, false], 'max', 1)).toBe(edges);
    expect(scaleEdges(edges, [true, true, true], 'max', 3)).toBe(edges);
    expect(scaleEdges(edges, [false, false, false], 'max', -1)).toBeNull();
  });
});
