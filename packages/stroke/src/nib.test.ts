import { describe, it, expect } from 'vitest';
import { boundsOfPath, pathContainsPoint, pathSignedArea, PathBuilder, type Path } from '@weasel-js/geom';
import { strokeToPath } from './strokeToPath';

const line = (x0: number, y0: number, x1: number, y1: number) =>
  new PathBuilder().moveTo(x0, y0).lineTo(x1, y1).build();
const area = (p: Path): number => Math.abs(pathSignedArea(p));
const PAINT = { color: '#000' };
const LEVEL_NIB = { angle: 0, ratio: 0.2 };

describe('a stroke drawn with a broad nib', () => {
  it('is thinnest moving along the nib', () => {
    const out = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: 10, nib: LEVEL_NIB });
    expect(boundsOfPath(out).height).toBeCloseTo(2, 3);
  });

  it('is widest moving across the nib', () => {
    const out = strokeToPath(line(0, 0, 0, 100), { paint: PAINT, width: 10, nib: LEVEL_NIB });
    expect(boundsOfPath(out).width).toBeCloseTo(10, 3);
  });

  it('measures the nib counterclockwise, up the screen', () => {
    // 45° counterclockwise points up and to the right in y-down coordinates.
    const nib = { angle: Math.PI / 4, ratio: 0.2 };
    const along = strokeToPath(line(0, 0, 100, -100), { paint: PAINT, width: 10, nib });
    const across = strokeToPath(line(0, 0, 100, 100), { paint: PAINT, width: 10, nib });
    const len = Math.hypot(100, 100);
    expect(area(along)).toBeCloseTo(len * 2, 0);
    expect(area(across)).toBeCloseTo(len * 10, 0);
  });

  it('grows smoothly between the two', () => {
    // At 45° to the nib an elliptical nib of ratio r draws sqrt((1 + r²) / 2).
    const out = strokeToPath(line(0, 0, 100, 100), { paint: PAINT, width: 10, nib: LEVEL_NIB });
    expect(area(out)).toBeCloseTo(Math.hypot(100, 100) * 10 * Math.sqrt((1 + 0.04) / 2), 0);
  });

  it('gives each side of a corner its own width', () => {
    const square = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();
    const out = strokeToPath(square, { paint: PAINT, width: 10, nib: LEVEL_NIB, join: 'miter' });
    // The level sides are 2 thick, the upright ones 10, right up to the corner.
    expect(pathContainsPoint(out, 50, 0.9)).toBe(true);
    expect(pathContainsPoint(out, 50, 1.5)).toBe(false);
    expect(pathContainsPoint(out, 104.5, 50)).toBe(true);
    expect(pathContainsPoint(out, 104.5, 3)).toBe(true);
    expect(pathContainsPoint(out, 20, 1.5)).toBe(false);
  });

  it('runs a round join between the widths either side of it', () => {
    const square = new PathBuilder().moveTo(0, 0).lineTo(100, 0).lineTo(100, 100).lineTo(0, 100).close().build();
    const out = strokeToPath(square, { paint: PAINT, width: 10, nib: LEVEL_NIB, join: 'round' });
    expect(pathContainsPoint(out, 103, -0.5)).toBe(true);
    expect(pathContainsPoint(out, 100.5, -2)).toBe(false);
  });

  it('multiplies per-vertex widths', () => {
    const out = strokeToPath(line(0, 0, 100, 0), {
      paint: PAINT, width: 10, vertexWidths: [4, 4], nib: { angle: 0, ratio: 0.5 },
    });
    expect(boundsOfPath(out).height).toBeCloseTo(2, 3);
  });

  it('keeps its widths through a dash', () => {
    const out = strokeToPath(line(0, 0, 100, 0), {
      paint: PAINT, width: 2, vertexWidths: [2, 6], dash: [10, 10],
    });
    expect(pathContainsPoint(out, 85, 2.5)).toBe(true);
    expect(pathContainsPoint(out, 5, 1.5)).toBe(false);
  });
});
