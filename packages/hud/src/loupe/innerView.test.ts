import { describe, it, expect } from 'vitest';
import { loupeInnerView } from './innerView';

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
