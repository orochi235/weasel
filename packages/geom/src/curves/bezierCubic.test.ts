import { describe, it, expect } from 'vitest';
import { bezierCubic } from './bezierCubic';
import type { SharedAnchor } from './types';

describe('bezierCubic', () => {
  it('evaluate at t=0 returns first anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0, inHandle: { x: 70, y: 30 } },
    ];
    const p = bezierCubic.evaluate(anchors, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('evaluate at t=1 returns last anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0, inHandle: { x: 70, y: 30 } },
    ];
    const p = bezierCubic.evaluate(anchors, 1);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
  });

  it('toPath returns a polygon with M then C commands', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0, outHandle: { x: 30, y: -30 } },
      { x: 100, y: 0, inHandle: { x: 70, y: -30 } },
    ];
    const path = bezierCubic.toPath(anchors);
    expect(path.kind).toBe('polygon');
    expect(path.commands[0]).toBe(0); // PATH_M
    expect(path.commands[1]).toBe(2); // PATH_C
  });

  it('curvatureAt returns 0 for collinear anchors with collinear handles', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0, outHandle: { x: 30, y: 0 } },
      { x: 100, y: 0, inHandle: { x: 70, y: 0 } },
    ];
    const k = bezierCubic.curvatureAt(anchors, 0.5);
    expect(Math.abs(k)).toBeLessThan(1e-6);
  });

  it('discriminators emits one handle pair per relevant anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0, outHandle: { x: 30, y: 30 } },
      { x: 100, y: 0, inHandle: { x: 70, y: 30 } },
    ];
    const d = bezierCubic.discriminators(anchors);
    const handles = d.filter((x) => x.kind === 'handle');
    expect(handles.length).toBe(2);
  });
});
