import { describe, it, expect } from 'vitest';
import { boundsOfPath, pathContainsPoint, pathSignedArea, PathBuilder, type Path } from '@weasel-js/geom';
import { strokeToPath } from './strokeToPath';

const line = (x0: number, y0: number, x1: number, y1: number) =>
  new PathBuilder().moveTo(x0, y0).lineTo(x1, y1).build();
const SQUARE: Path = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();
const area = (p: Path): number => Math.abs(pathSignedArea(p));
const PAINT = { color: '#000' };

describe('strokeToPath', () => {
  it('outlines a butt-capped line as its rectangle', () => {
    const out = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: 10 });
    expect(boundsOfPath(out)).toMatchObject({ x: 0, y: -5, width: 100, height: 10 });
    expect(area(out)).toBeCloseTo(1000, 3);
  });

  it('carries the cap', () => {
    const out = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: 10, cap: 'square' });
    expect(boundsOfPath(out)).toMatchObject({ x: -5, width: 110 });
  });

  it('outlines a closed path as a ring with a hole', () => {
    const out = strokeToPath(SQUARE, { paint: PAINT, width: 10 });
    expect(area(out)).toBeCloseTo(110 * 110 - 90 * 90, 2);
    expect(pathContainsPoint(out, 0, 50)).toBe(true);
    expect(pathContainsPoint(out, 50, 50)).toBe(false);
  });

  it('counts a crossing once', () => {
    const cross = new PathBuilder().moveTo(0, 50).lineTo(100, 50).moveTo(50, 0).lineTo(50, 100).build();
    expect(area(strokeToPath(cross, { paint: PAINT, width: 10 }))).toBeCloseTo(1900, 2);
  });

  it('keeps an inner stroke inside the path and an outer one outside it', () => {
    const inner = strokeToPath(SQUARE, { paint: PAINT, width: 10, align: 'inner' });
    expect(boundsOfPath(inner)).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
    expect(area(inner)).toBeCloseTo(100 * 100 - 80 * 80, 2);
    const outer = strokeToPath(SQUARE, { paint: PAINT, width: 10, align: 'outer' });
    expect(area(outer)).toBeCloseTo(120 * 120 - 100 * 100, 2);
    expect(pathContainsPoint(outer, 5, 50)).toBe(false);
  });

  it('breaks a dashed stroke into its dashes', () => {
    const out = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: 10, dash: [20, 20] });
    expect(area(out)).toBeCloseTo(3 * 200, 2);
    expect(pathContainsPoint(out, 30, 0)).toBe(false);
  });

  it('reads a screen width at the scale it is given', () => {
    const out = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: { px: 10 } }, { scale: 2 });
    expect(boundsOfPath(out)).toMatchObject({ y: -2.5, height: 5 });
  });

  it('includes a marker head, and stops the line under it', () => {
    const plain = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: 4 });
    const headed = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: 4, markerEnd: 'arrow' });
    // The head is wider than the line it caps.
    expect(boundsOfPath(headed).height).toBeGreaterThan(boundsOfPath(plain).height);
    expect(boundsOfPath(headed).x + boundsOfPath(headed).width).toBeCloseTo(100, 3);
  });

  it('resolves round joins and caps on a curve that doubles back', () => {
    const loop = new PathBuilder().moveTo(0, 0).curveTo(120, 0, -20, 80, 100, 80).lineTo(0, 0).build();
    const out = strokeToPath(loop, { paint: PAINT, width: 12, join: 'round', cap: 'round' });
    const b = boundsOfPath(out);
    expect(b.x).toBeCloseTo(-6, 1);
    expect(b.y).toBeCloseTo(-6, 1);
    expect(pathContainsPoint(out, 100, 80)).toBe(true);
  });

  it('answers an empty path for a stroke with no width', () => {
    expect(strokeToPath(SQUARE, { paint: PAINT, width: 0 }).commands.length).toBe(0);
  });
});
