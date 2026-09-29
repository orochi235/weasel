import { describe, it, expect } from 'vitest';
import { nurbs } from './nurbs';
import type { SharedAnchor } from './types';

describe('nurbs', () => {
  it('evaluate at t=0 returns first anchor (uniform open knot vector)', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 0 },
    ];
    const p = nurbs.evaluate(anchors, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('evaluate at t=1 returns last anchor (uniform open knot vector)', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 0 },
    ];
    const p = nurbs.evaluate(anchors, 1);
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(0);
  });

  it('with all weights = 1, midpoint of a 4-anchor square approximates a flat curve', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 0 },
    ];
    const p = nurbs.evaluate(anchors, 0.5);
    expect(p.y).toBeCloseTo(0);
  });

  it('discriminators emits one weight slider per anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }, { x: 150, y: 50 },
    ];
    const d = nurbs.discriminators(anchors);
    const sliders = d.filter((x) => x.kind === 'slider' && x.field === 'weight');
    expect(sliders.length).toBe(4);
  });

  it('toPath returns a non-empty polygon for valid anchors', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }, { x: 150, y: 100 },
    ];
    const path = nurbs.toPath(anchors);
    expect(path.kind).toBe('polygon');
    expect(path.coords.length).toBeGreaterThan(2);
  });

  it('returns empty path for fewer than 2 anchors', () => {
    const path = nurbs.toPath([]);
    expect(path.coords.length).toBe(0);
  });
});
