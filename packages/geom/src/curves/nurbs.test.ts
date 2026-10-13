import { describe, it, expect } from 'vitest';
import { nurbs } from './nurbs';
import type { SharedAnchor } from './types';

describe('nurbs', () => {
  it('evaluates four unit-weight anchors as the cubic Bezier they control', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 40, y: 80 }, { x: 100, y: 0 }, { x: 150, y: 20 },
    ];
    // Bernstein weights at t = 0.25 are (27, 27, 9, 1) / 64.
    const p = nurbs.evaluate(anchors, 0.25);
    expect(p.x).toBeCloseTo(33.28125);
    expect(p.y).toBeCloseTo(34.0625);
    expect(nurbs.evaluate(anchors, 0)).toEqual({ x: 0, y: 0 });
    expect(nurbs.evaluate(anchors, 1)).toEqual({ x: 150, y: 20 });
  });

  it('discriminators emits one weight slider per anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }, { x: 150, y: 50 },
    ];
    const d = nurbs.discriminators(anchors);
    const sliders = d.filter((x) => x.kind === 'slider' && x.field === 'weight');
    expect(sliders.length).toBe(4);
  });
});
