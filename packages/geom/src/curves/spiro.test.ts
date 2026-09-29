import { describe, it, expect } from 'vitest';
import { spiro } from './spiro';
import type { SharedAnchor } from './types';

describe('spiro', () => {
  it('evaluate at t=0 returns first anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ];
    const p = spiro.evaluate(anchors, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('evaluate at t=1 returns last anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ];
    const p = spiro.evaluate(anchors, 1);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(100);
  });

  it('toPath returns a polygon with M + C commands per segment', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ];
    const path = spiro.toPath(anchors);
    expect(path.kind).toBe('polygon');
    expect(path.commands[0]).toBe(0); // PATH_M
    expect(path.commands[1]).toBe(2); // PATH_C
  });

  it('discriminators emits one type picker per anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ];
    const d = spiro.discriminators(anchors);
    const enums = d.filter((x) => x.kind === 'enum' && x.field === 'spiroType');
    expect(enums.length).toBe(3);
  });

  it('returns empty path for fewer than 2 anchors', () => {
    const path = spiro.toPath([]);
    expect(path.coords.length).toBe(0);
  });

  it('corner anchors produce sharper segments than smooth anchors', () => {
    const smooth: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ];
    const corner: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0, spiroType: 'corner' }, { x: 100, y: 100 },
    ];
    // Sample at t=0.25 — interior of segment 0 (between anchors 0 and 1).
    // For the smooth case, the tangent at anchor 1 averages the two
    // incoming edges and curves "downward" away from the polyline at
    // anchor 1; for the corner case, the segment-0 outgoing tangent at
    // anchor 1 is pinned to the segment-0 edge direction (rightward),
    // so the curve hugs the polyline tighter near the corner anchor.
    // Measure distance from each curve point to the polyline edge
    // y=0 — the smooth case bows further off the line than the corner.
    const smoothPt = spiro.evaluate(smooth, 0.25);
    const cornerPt = spiro.evaluate(corner, 0.25);
    expect(Math.abs(cornerPt.y)).toBeLessThan(Math.abs(smoothPt.y));
  });
});
