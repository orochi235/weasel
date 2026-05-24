import { describe, it, expect } from 'vitest';
import { bezierQuadratic } from './bezierQuadratic';
import type { SharedAnchor } from './types';

describe('bezierQuadratic', () => {
  it('evaluate at t=0 returns first anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const p = bezierQuadratic.evaluate(anchors, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('evaluate at t=1 returns last anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const p = bezierQuadratic.evaluate(anchors, 1);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
  });

  it('toPath returns a polygon with M then Q commands', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0, outHandle: { x: 30, y: -30 } },
      { x: 100, y: 0, inHandle: { x: 70, y: -30 } },
    ];
    const path = bezierQuadratic.toPath(anchors);
    expect(path.kind).toBe('polygon');
    expect(path.commands[0]).toBe(0); // PATH_M
    expect(path.commands[1]).toBe(3); // PATH_Q
  });

  it('midpoint approximation: quadratic control sits between the two cubic controls', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0, outHandle: { x: 30, y: -30 } },
      { x: 100, y: 0, inHandle: { x: 70, y: -30 } },
    ];
    const path = bezierQuadratic.toPath(anchors);
    expect(path.coords[2]).toBeCloseTo(50);
    expect(path.coords[3]).toBeCloseTo(-30);
  });
});
