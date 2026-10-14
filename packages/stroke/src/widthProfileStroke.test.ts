import { describe, it, expect } from 'vitest';
import { boundsOfPath, pathContainsPoint, pathSignedArea, PathBuilder, type Path } from '@weasel-js/geom';
import { strokeToPath } from './strokeToPath';
import { tessellateStroke } from './tessellate/stroke';

const line = (x0: number, y0: number, x1: number, y1: number) =>
  new PathBuilder().moveTo(x0, y0).lineTo(x1, y1).build();
const area = (p: Path): number => Math.abs(pathSignedArea(p));
const PAINT = { color: '#000' };
const RAMP = [{ t: 0, width: 1 }, { t: 1, width: 3 }];

describe('a stroke with a width profile', () => {
  it('widens along its length as the profile says', () => {
    const out = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: 2, widthProfile: RAMP });
    // Width runs 2 → 6 linearly: a trapezoid of mean width 4.
    expect(area(out)).toBeCloseTo(400, 0);
    expect(pathContainsPoint(out, 2, 0.9)).toBe(true);
    expect(pathContainsPoint(out, 2, 1.5)).toBe(false);
    expect(pathContainsPoint(out, 98, 2.8)).toBe(true);
  });

  it('follows the smooth curve between stops, not a straight line', () => {
    const bulge = [{ t: 0, width: 1 }, { t: 0.5, width: 5 }, { t: 1, width: 1 }];
    const out = strokeToPath(line(0, 0, 100, 0), { paint: PAINT, width: 2, widthProfile: bulge });
    expect(boundsOfPath(out).height).toBeCloseTo(10, 1);
    // Level at the peak: just off it the stroke is still nearly full width.
    expect(pathContainsPoint(out, 45, 4.8)).toBe(true);
  });

  it('measures each subpath on its own', () => {
    const two = new PathBuilder().moveTo(0, 0).lineTo(100, 0).moveTo(0, 50).lineTo(10, 50).build();
    const out = strokeToPath(two, { paint: PAINT, width: 2, widthProfile: RAMP });
    expect(pathContainsPoint(out, 9.5, 52.8)).toBe(true);
  });

  it('keeps its width through a dash', () => {
    const out = strokeToPath(line(0, 0, 100, 0), {
      paint: PAINT, width: 2, widthProfile: RAMP, dash: [10, 10],
    });
    expect(pathContainsPoint(out, 85, 2.5)).toBe(true);
    expect(pathContainsPoint(out, 5, 1.5)).toBe(false);
  });

  it('multiplies per-vertex widths', () => {
    const out = strokeToPath(line(0, 0, 100, 0), {
      paint: PAINT, width: 2, vertexWidths: [4, 4], widthProfile: RAMP,
    });
    expect(boundsOfPath(out).height).toBeCloseTo(12, 1);
  });

  it('carries the widths onto a rounded cap', () => {
    const out = strokeToPath(line(0, 0, 100, 0), {
      paint: PAINT, width: 2, cap: 'round', widthProfile: RAMP,
    });
    expect(pathContainsPoint(out, 102.5, 0)).toBe(true);
    expect(pathContainsPoint(out, -1.5, 0)).toBe(false);
  });

  it('draws a ribbon that tapers between the few points a straight line has', () => {
    const mesh = tessellateStroke(line(0, 0, 100, 0), { paint: PAINT, width: 2, widthProfile: RAMP });
    expect(mesh.vertices.length / 2).toBeGreaterThan(8);
  });
});
