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
  const none = { top: 0, right: 0, bottom: 0, left: 0 };
  const diamond = outlineOf([[50, 0], [100, 50], [50, 100], [0, 50]]);
  /** The content's rectangle, in viewBox terms, inside the box `insets` make around it. */
  const held = (content: { w: number; h: number }, insets: typeof none) => {
    const w = content.w + insets.left + insets.right;
    const h = content.h + insets.top + insets.bottom;
    return { left: (insets.left / w) * 100, right: ((insets.left + content.w) / w) * 100, top: (insets.top / h) * 100, bottom: ((insets.top + content.h) / h) * 100 };
  };
  const pointsInside = (points: readonly (readonly [number, number])[], r: ReturnType<typeof held>) =>
    points.filter(([x, y]) => x > r.left && x < r.right && y > r.top && y < r.bottom).length;

  it('returns the floor itself while the floor keeps the content clear', () => {
    const floor = { top: 20, right: 60, bottom: 20, left: 60 };
    expect(fitInsets(diamond, { w: 40, h: 10 }, floor)).toBe(floor);
  });

  it('pads a diamond until the content is clear of it, in about the smallest box that is', () => {
    const content = { w: 100, h: 20 };
    const insets = fitInsets(diamond, content, none);
    expect(pointsInside(diamond, held(content, insets))).toBe(0);
    // A rectangle in a diamond takes at best half its box each way: 200 by 40.
    const area = (content.w + insets.left + insets.right) * (content.h + insets.top + insets.bottom);
    expect(area).toBeGreaterThanOrEqual(200 * 40);
    expect(area).toBeLessThan(200 * 40 * 1.05);
  });

  it('never goes under the floor on any side', () => {
    const floor = { top: 12, right: 2, bottom: 12, left: 2 };
    const insets = fitInsets(diamond, { w: 100, h: 20 }, floor);
    expect(insets.top).toBeGreaterThanOrEqual(12);
    expect(insets.bottom).toBeGreaterThanOrEqual(12);
    expect(insets.left).toBeGreaterThan(2);
    expect(pointsInside(diamond, held({ w: 100, h: 20 }, insets))).toBe(0);
  });

  describe('with a clearance, for an outline an effect or a negative bloat pushes inward', () => {
    it('keeps the content that far from the outline', () => {
      const content = { w: 100, h: 20 };
      const insets = fitInsets(diamond, content, none, 4);
      const tight = fitInsets(diamond, content, none);
      expect(insets.left).toBeGreaterThan(tight.left);
      expect(insets.top).toBeGreaterThan(tight.top);
      const grown = { w: content.w + 8, h: content.h + 8 };
      const around = { top: insets.top - 4, right: insets.right - 4, bottom: insets.bottom - 4, left: insets.left - 4 };
      expect(pointsInside(diamond, held(grown, around))).toBe(0);
    });

    it('returns the floor itself while the floor keeps the clearance too', () => {
      const floor = { top: 20, right: 60, bottom: 20, left: 60 };
      expect(fitInsets(diamond, { w: 40, h: 10 }, floor, 2)).toBe(floor);
    });

    it('grows a floor that clears the outline but not by the clearance', () => {
      const content = { w: 100, h: 20 };
      const floor = fitInsets(diamond, content, none);
      const insets = fitInsets(diamond, content, floor, 4);
      expect(insets).not.toBe(floor);
      expect(insets.left).toBeGreaterThan(floor.left);
    });
  });

  it.each(['quatrefoil', 'octant-spline', 'octant-bspline', 'puzzle'] as const)('clears the %s outline at any content length', (key) => {
    const base = BASES[key];
    const points = outlinePoints(base.build(base.defaults, 100, 100));
    const floor = base.insets as typeof none;
    for (const w of [10, 40, 90, 200, 600]) {
      const content = { w, h: 14 };
      expect(pointsInside(points, held(content, fitInsets(points, content, floor))), `content ${w} wide`).toBe(0);
    }
  });
});
