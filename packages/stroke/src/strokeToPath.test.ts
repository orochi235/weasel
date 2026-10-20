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

  it('outlines a stroke drawn in a stretched frame as that frame stretches it', () => {
    // A 10-unit square drawn four times as wide: the stroke is 8 thick on its
    // upright sides and 2 on the level ones.
    const drawn: Path = new PathBuilder().moveTo(0, 0).lineTo(40, 0).lineTo(40, 10).lineTo(0, 10).close().build();
    const out = strokeToPath(drawn, { paint: PAINT, width: 2 }, { frame: [4, 0, 0, 1, 0, 0] });
    const b = boundsOfPath(out);
    expect(b.x).toBeCloseTo(-4);
    expect(b.y).toBeCloseTo(-1);
    expect(b.width).toBeCloseTo(48);
    expect(b.height).toBeCloseTo(12);
    expect(pathContainsPoint(out, 3, 5)).toBe(true);
    expect(pathContainsPoint(out, 5, 5)).toBe(false);
    expect(pathContainsPoint(out, 20, 0.9)).toBe(true);
    expect(pathContainsPoint(out, 20, 1.5)).toBe(false);
  });

  it('holds a { px } width on screen under a view that scales each axis apart', () => {
    // Two pixels wide at 4 by 1: half a world unit across x, two across y.
    const screen = { frame: [1 / 4, 0, 0, 1, 0, 0] as const };
    const out = strokeToPath(line(0, 0, 0, 100), { paint: PAINT, width: { px: 2 } }, screen);
    expect(boundsOfPath(out).width).toBeCloseTo(0.5);
    const level = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: { px: 2 } }, screen);
    expect(boundsOfPath(level).height).toBeCloseTo(2);
  });

  it('answers an empty path for a frame that flattens everything', () => {
    const out = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: 10 }, { frame: [0, 0, 0, 0, 0, 0] });
    expect(out.commands.length).toBe(0);
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
    const headed = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: 4, markerEnd: 'diamond-hollow' });
    expect(boundsOfPath(headed).height).toBeGreaterThan(boundsOfPath(plain).height);
    expect(pathContainsPoint(headed, 50, 0)).toBe(true);
    expect(pathContainsPoint(headed, 92, 0)).toBe(false);
  });

  it('resolves round joins and caps on a curve that doubles back', () => {
    const loop = new PathBuilder().moveTo(0, 0).curveTo(120, 0, -20, 80, 100, 80).lineTo(0, 0).build();
    const out = strokeToPath(loop, { paint: PAINT, width: 12, join: 'round', cap: 'round' });
    const b = boundsOfPath(out);
    expect(b.x).toBeCloseTo(-6, 1);
    expect(b.y).toBeCloseTo(-6, 1);
    expect(pathContainsPoint(out, 100, 80)).toBe(true);
  });

  it('outlines a vertexWidths pair at each edge\'s own distance, aligned or not', () => {
    const sided = { paint: PAINT, width: 4, vertexWidths: [{ left: 1, right: 5 }, { left: 1, right: 5 }] };
    expect(boundsOfPath(strokeToPath(line(0, 0, 100, 0), sided))).toMatchObject({ y: -1, height: 6 });
    const outer = strokeToPath(SQUARE, { ...sided, vertexWidths: [{ left: 1, right: 5 }, { left: 1, right: 5 }, { left: 1, right: 5 }, { left: 1, right: 5 }], align: 'outer' as const });
    // The square runs clockwise on screen, so its left side is outside.
    expect(boundsOfPath(outer).x).toBeCloseTo(-2, 3);
  });

  it('outlines a long wavy curve whose ribbon overlaps itself', () => {
    // 300 humps, each rising 30 and falling back over 10: wider than the gap between
    // its own flanks, so the ribbon overlaps itself all along.
    const b = new PathBuilder().moveTo(0, 0);
    for (let i = 0; i < 300; i++) b.curveTo(i * 10 + 3, 40, i * 10 + 7, 40, i * 10 + 10, 0);
    const out = strokeToPath(b.build(), { paint: PAINT, width: 6, join: 'round' }, { flattenTolerance: 0.05 });
    const box = boundsOfPath(out);
    expect(box.x).toBeCloseTo(-3, 0);
    expect(box.width).toBeCloseTo(3006, 0);
    expect(pathContainsPoint(out, 1505, 30)).toBe(true);
    expect(pathContainsPoint(out, 1505, 40)).toBe(false);
    expect(pathContainsPoint(out, 1505, -10)).toBe(false);
    // 300 humps is the size that overran the old union's segment limit, and it takes
    // about 2.5 s alone, so a loaded worker pushes it past the default 5 s.
  }, 20_000);

  it('answers an empty path for a stroke with no width', () => {
    expect(strokeToPath(SQUARE, { paint: PAINT, width: 0 }).commands.length).toBe(0);
  });
});
