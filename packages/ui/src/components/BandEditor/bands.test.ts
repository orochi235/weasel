import { describe, it, expect } from 'vitest';
import {
  bandBounds,
  clampBandShift,
  clampSeamTo,
  mergeBand,
  moveBandEdges,
  normalizeBands,
  seamBounds,
  setSeam,
  splitBands,
  unitEdges,
  type Band,
} from './bands';
import { linearScale } from './scale';

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

describe('seam clamping', () => {
  const bands = normalizeBands(fixture(), MIN);

  it('bounds a seam by the edges either side of it', () => {
    expect(seamBounds(bands, 0, MIN, MAX)).toEqual([0, 60]);
    expect(seamBounds(bands, 1, MIN, MAX)).toEqual([20, 100]);
  });

  it('stops a seam dragged past its right neighbour, at the neighbour', () => {
    expect(clampSeamTo(bands, 0, 95, MIN, MAX)).toBe(60);
    const next = setSeam(bands, 0, clampSeamTo(bands, 0, 95, MIN, MAX));
    expect(next.map((b) => b.from)).toEqual([0, 60, 60]);
  });

  it('stops a seam dragged past its left neighbour, at the neighbour', () => {
    expect(clampSeamTo(bands, 1, -30, MIN, MAX)).toBe(20);
    const next = setSeam(bands, 1, clampSeamTo(bands, 1, -30, MIN, MAX));
    expect(next.map((b) => b.from)).toEqual([0, 20, 20]);
  });

  it('never reorders and never drops a band', () => {
    for (const target of [-1000, -1, 0, 19, 21, 60, 61, 1000]) {
      for (const index of [0, 1]) {
        const next = setSeam(bands, index, clampSeamTo(bands, index, target, MIN, MAX));
        const froms = next.map((b) => b.from);
        expect(next).toHaveLength(bands.length);
        expect([...froms].sort((a, b) => a - b)).toEqual(froms);
      }
    }
  });

  it('returns the same list when the seam does not move', () => {
    expect(setSeam(bands, 0, 20)).toBe(bands);
  });
});

describe('clampBandShift', () => {
  // Bands at [0, .2], [.2, .6], [.6, 1].
  const edges = [0, 0.2, 0.6, 1];

  it('refuses to move the first or last band, whose outer edges are pinned', () => {
    expect(clampBandShift(edges, 0, 0.3)).toBe(0);
    expect(clampBandShift(edges, 2, -0.3)).toBe(0);
  });

  it('passes a shift that keeps both neighbours alive', () => {
    expect(clampBandShift(edges, 1, 0.1)).toBeCloseTo(0.1, 12);
  });

  it('stops when a neighbour would be squeezed past its own far edge', () => {
    expect(clampBandShift(edges, 1, 5)).toBeCloseTo(0.4, 12);
    expect(clampBandShift(edges, 1, -5)).toBeCloseTo(-0.2, 12);
  });
});

describe('moveBandEdges', () => {
  it('moves both seams of a band, preserving its span', () => {
    const bands = normalizeBands(fixture(), MIN);
    const next = moveBandEdges(bands, 1, 30, 70);
    expect(next.map((b) => b.from)).toEqual([0, 30, 70]);
    expect(next.map((b) => b.data)).toEqual(['a', 'b', 'c']);
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
