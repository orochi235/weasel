import { describe, it, expect } from 'vitest';
import { trimPolyline } from './trim';
import type { Polyline } from './polyline';

/** A straight run along +X from (0,0) to (10,0), sampled every 2 units. */
function straight(): Polyline {
  return {
    points: [0, 0, 2, 0, 4, 0, 6, 0, 8, 0, 10, 0],
    closed: false,
    anchorA: new Uint32Array([0, 0, 0, 0, 0, 0]),
    anchorB: new Uint32Array([1, 1, 1, 1, 1, 1]),
    anchorT: new Float32Array([0, 0.2, 0.4, 0.6, 0.8, 1]),
  };
}

describe('trimPolyline', () => {
  it('returns the polyline untouched when both insets are zero', () => {
    const pl = straight();
    expect(trimPolyline(pl, 0, 0)).toBe(pl);
  });

  it('moves the end point back by the end inset', () => {
    const out = trimPolyline(straight(), 0, 3)!;
    const n = out.points.length;
    expect(out.points[n - 2]).toBeCloseTo(7, 6);
    expect(out.points[n - 1]).toBeCloseTo(0, 6);
    expect(out.points[0]).toBeCloseTo(0, 6);
  });

  it('moves the start point forward by the start inset', () => {
    const out = trimPolyline(straight(), 2.5, 0)!;
    expect(out.points[0]).toBeCloseTo(2.5, 6);
    expect(out.points[1]).toBeCloseTo(0, 6);
  });

  it('trims both ends at once', () => {
    const out = trimPolyline(straight(), 1, 1)!;
    const n = out.points.length;
    expect(out.points[0]).toBeCloseTo(1, 6);
    expect(out.points[n - 2]).toBeCloseTo(9, 6);
  });

  it('drops the interior points the trim consumed', () => {
    const out = trimPolyline(straight(), 5, 0)!;
    // Original interior points at x = 6, 8; plus the cut at 5 and the end at 10.
    expect(Array.from(out.points).filter((_, i) => i % 2 === 0)).toEqual([5, 6, 8, 10]);
  });

  it('interpolates the anchor param at a cut inside one anchor span', () => {
    const out = trimPolyline(straight(), 3, 0)!;
    // x=3 is halfway between the samples at t=0.2 and t=0.4.
    expect(out.anchorT![0]).toBeCloseTo(0.3, 5);
    expect(out.anchorA![0]).toBe(0);
    expect(out.anchorB![0]).toBe(1);
  });

  it('returns null when the insets consume the whole run', () => {
    expect(trimPolyline(straight(), 6, 6)).toBeNull();
    expect(trimPolyline(straight(), 10, 0)).toBeNull();
  });

  it('leaves a closed subpath alone — it has no free ends', () => {
    const loop: Polyline = { ...straight(), closed: true };
    expect(trimPolyline(loop, 3, 3)).toBe(loop);
  });

  it('follows the actual arc length around a corner', () => {
    // (0,0) -> (4,0) -> (4,4): total length 8. Trim 6 from the start lands
    // 2 units up the vertical leg.
    const bent: Polyline = {
      points: [0, 0, 4, 0, 4, 4],
      closed: false,
      anchorA: new Uint32Array([0, 1, 1]),
      anchorB: new Uint32Array([1, 2, 2]),
      anchorT: new Float32Array([0, 0, 1]),
    };
    const out = trimPolyline(bent, 6, 0)!;
    expect(out.points[0]).toBeCloseTo(4, 6);
    expect(out.points[1]).toBeCloseTo(2, 6);
  });

  it('interpolates per-point widths at the cuts', () => {
    const pl: Polyline = { ...straight(), widths: new Float32Array([1, 2, 3, 4, 5, 6]) };
    const out = trimPolyline(pl, 3, 0)!;
    // x=3 sits halfway between the samples carrying width 2 and 3.
    expect(out.widths![0]).toBeCloseTo(2.5, 5);
  });
});
