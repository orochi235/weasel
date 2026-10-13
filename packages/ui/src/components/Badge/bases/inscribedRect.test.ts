import { describe, expect, it } from 'vitest';
import { BASES } from './index';
import { fitInsets, inscribedRect, outlinePoints } from './inscribedRect';
import { polygonSampler } from './polygonSampler';

const outlineOf = (verts: [number, number][]) => outlinePoints(polygonSampler(verts, 100, 100));

describe('inscribedRect', () => {
  it('is the whole box for an outline on the box', () => {
    expect(inscribedRect(outlineOf([[0, 0], [100, 0], [100, 100], [0, 100]]))).toEqual({ left: 0, top: 0, right: 100, bottom: 100 });
  });

  it('is the middle half of a diamond, the largest rectangle one holds', () => {
    const rect = inscribedRect(outlineOf([[50, 0], [100, 50], [50, 100], [0, 50]]));
    for (const [side, want] of [['left', 25], ['top', 25], ['right', 75], ['bottom', 75]] as const) {
      expect(Math.abs(rect[side] - want)).toBeLessThan(1);
    }
  });

  it('stops at a notch cut into one side only', () => {
    const rect = inscribedRect(outlineOf([[0, 0], [100, 0], [100, 100], [0, 100], [0, 60], [20, 50], [0, 40]]));
    // The outline is sampled, so the notch's tip is found to within half a step.
    expect(rect.left).toBeGreaterThan(19.75);
    expect(rect.left).toBeLessThanOrEqual(20);
    expect(rect).toMatchObject({ top: 0, right: 100, bottom: 100 });
  });

  it.each(['quatrefoil', 'octant-spline', 'octant-bspline', 'puzzle'] as const)('holds no point of the %s outline', (key) => {
    const base = BASES[key];
    const points = outlinePoints(base.build(base.defaults, 100, 100));
    const rect = inscribedRect(points);
    expect((rect.right - rect.left) * (rect.bottom - rect.top)).toBeGreaterThan(400);
    const inside = points.filter(([x, y]) => x > rect.left && x < rect.right && y > rect.top && y < rect.bottom);
    expect(inside).toEqual([]);
  });
});

describe('fitInsets', () => {
  it('pads the content out until it covers the rectangle and no more', () => {
    const insets = fitInsets({ left: 25, top: 10, right: 75, bottom: 60 }, { w: 100, h: 20 });
    // The content is half the box's width and half its height.
    expect(insets).toEqual({ top: 4, right: 50, bottom: 16, left: 50 });
  });
});
