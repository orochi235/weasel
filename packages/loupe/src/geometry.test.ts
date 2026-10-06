import { describe, it, expect } from 'vitest';
import { loupeExtent, loupeInnerView, placeBand } from './geometry';

const outer = { x: 0, y: 0, scale: { x: 2, y: 2 } };
const rect = { x: 500, y: 400, w: 200, h: 100 };

describe('loupeInnerView', () => {
  it('multiplies the outer scale by the factor on both axes', () => {
    const v = loupeInnerView({ x: 50, y: 25 }, outer, rect, 8);
    expect(v.scale).toEqual({ x: 16, y: 16 });
  });

  it('centers the aimed world point in the content rect', () => {
    const v = loupeInnerView({ x: 50, y: 25 }, outer, rect, 8);
    expect((50 - v.x) * v.scale.x).toBeCloseTo(rect.w / 2);
    expect((25 - v.y) * v.scale.y).toBeCloseTo(rect.h / 2);
  });

  it('respects a non-uniform outer scale', () => {
    const v = loupeInnerView({ x: 0, y: 0 }, { x: 0, y: 0, scale: { x: 1, y: 4 } }, rect, 2);
    expect(v.scale).toEqual({ x: 2, y: 8 });
  });

  it('a factor of 1 shows the same magnification as the outer view', () => {
    const v = loupeInnerView({ x: 10, y: 10 }, outer, rect, 1);
    expect(v.scale).toEqual(outer.scale);
  });
});

describe('loupeExtent', () => {
  it('reads one number as a square, and passes a width and height through', () => {
    expect(loupeExtent(120)).toEqual({ width: 120, height: 120 });
    expect(loupeExtent({ width: 300, height: 40 })).toEqual({ width: 300, height: 40 });
  });
});

describe('placeBand', () => {
  const band = { x: 100, y: 200, w: 200, h: 20 };

  it('magnifies by the factor when the band fits, drawn over the band', () => {
    expect(placeBand({ band, factor: 2, maxWidth: 1000 })).toEqual({
      center: { x: 200, y: 210 },
      shows: { x: 200, y: 210 },
      width: 400,
      height: 40,
      factor: 2,
    });
  });

  it('magnifies by less where the factor would make the lens wider or taller than the host', () => {
    expect(placeBand({ band, factor: 8, maxWidth: 600 }).factor).toBe(3);
    expect(placeBand({ band, factor: 8, maxWidth: 6000, maxHeight: 100 }).factor).toBe(5);
  });

  it('moves the lens to stay on the host, and keeps showing the band', () => {
    const p = placeBand({ band, factor: 3, maxWidth: 600, maxHeight: 220 });
    expect(p.width).toBe(600);
    expect(p.center).toEqual({ x: 300, y: 190 });
    expect(p.shows).toEqual({ x: 200, y: 210 });
  });
});
