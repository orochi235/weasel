import { describe, it, expect } from 'vitest';
import { glyphCorners, placeGlyph, type PlacedGlyph } from './glyphCorners';

/** One quad: box (2, -8)–(6, 0) on a baseline at 0, its pen at x = 1. */
const quad = (rotate: number): number[] => [2, -8, 6, 0, 0, 0, 1, 1, 0, 1, rotate];

const corners = (q: number[], ox = 0, oy = 0, tan = 0): number[] => {
  const out: number[] = [];
  glyphCorners(q, 0, ox, oy, tan, out);
  return out.map((v) => Math.round(v * 1e9) / 1e9 + 0);
};

describe('glyphCorners', () => {
  it('gives an upright quad its own box, moved', () => {
    expect(corners(quad(0), 10, 20)).toEqual([12, 12, 16, 12, 16, 20, 12, 20]);
  });

  it('turns the corners clockwise about the pen on the baseline', () => {
    // A quarter turn takes (dx, dy) from the pen to (-dy, dx).
    expect(corners(quad(90), 10, 20)).toEqual([19, 21, 19, 25, 11, 25, 11, 21]);
  });

  it('leans before it turns', () => {
    // A lean of 0.5 moves the top corners 4 right; a half turn then mirrors both axes about the pen.
    expect(corners(quad(180), 0, 0, 0.5)).toEqual([-4, 8, -8, 8, -4, 0, 0, 0]);
  });
});

describe('placeGlyph', () => {
  const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;
  const place = (q: number[], grow: number, m: readonly number[] = identity, tan = 0): PlacedGlyph => {
    const out: PlacedGlyph = { xy: [], uv: [] };
    placeGlyph(q, 0, 0, 0, tan, m as never, grow, out);
    out.xy = out.xy.map((v) => Math.round(v * 1e9) / 1e9 + 0);
    out.uv = out.uv.map((v) => Math.round(v * 1e9) / 1e9 + 0);
    return out;
  };

  it('maps the corners through the transform and keeps the atlas rectangle', () => {
    const scaled = [3, 0, 0, 0, 3, 0, 5, 7, 1];
    expect(place(quad(0), 0, scaled)).toEqual({ xy: [11, -17, 23, -17, 23, 7, 11, 7], uv: [0, 0, 1, 1] });
  });

  it('grows the quad by screen distance, and the atlas rectangle with it', () => {
    // At 2 screen units a unit, growing by 1 adds half a unit a side: an eighth of the
    // box's width and a sixteenth of its height, in atlas terms.
    const m = [2, 0, 0, 0, 2, 0, 0, 0, 1];
    expect(place(quad(0), 1, m)).toEqual({ xy: [3, -17, 13, -17, 13, 1, 3, 1], uv: [-0.125, -0.0625, 1.125, 1.0625] });
  });

  it('grows a turned or leaning quad by the same distance across its sides', () => {
    for (const [q, tan] of [[quad(30), 0], [quad(0), 0.4]] as const) {
      const before = place(q, 0, identity, tan).xy, after = place(q, 1, identity, tan).xy;
      // The distance between the left and right sides, and between top and bottom, each grow by 2.
      const across = (c: number[], a: number, b: number, d: number): number => {
        const ex = c[d] - c[a], ey = c[d + 1] - c[a + 1];
        return Math.abs((c[b] - c[a]) * ey - (c[b + 1] - c[a + 1]) * ex) / Math.hypot(ex, ey);
      };
      expect(across(after, 0, 2, 6) - across(before, 0, 2, 6)).toBeCloseTo(2, 6);
      expect(across(after, 0, 6, 2) - across(before, 0, 6, 2)).toBeCloseTo(2, 6);
    }
  });
});
