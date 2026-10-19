import { describe, it, expect } from 'vitest';
import { PATH_C, PATH_M } from '../commands';
import type { Path, PolygonPath } from '../path';
import { pointInPath } from '../pathHitTest';
import { boundsOfPath } from './bounds';
import { pathToCubicContours } from './cubicContours';
import { growRegion } from './growRegion';
import { mergeRegion } from './mergeRegion';
import { pathFromD } from './pathFromD';
import { pathToD } from './pathToD';

const inPath = (p: Path, x: number, y: number) => pointInPath(p, x, y, { tolerance: 1e-4 });

/** Every grid point is filled by `merged` exactly where it is by `src`. */
function expectSameRegion(src: Path, merged: Path, step: number): void {
  const b = boundsOfPath(src);
  for (let y = b.y - step; y <= b.y + b.height + step; y += step) {
    for (let x = b.x - step; x <= b.x + b.width + step; x += step) {
      if (inPath(merged, x, y) !== inPath(src, x, y)) throw new Error(`(${x}, ${y}) differs`);
    }
  }
}

/** Points on `p`'s edges with fill on both sides, probed `e` either side of
 *  each segment's middle. */
function edgesInsideFill(p: PolygonPath, e: number): number {
  let n = 0;
  for (const { segs } of pathToCubicContours(p)) {
    for (const { c } of segs) {
      const x = (c[0] + 3 * c[2] + 3 * c[4] + c[6]) / 8,
        y = (c[1] + 3 * c[3] + 3 * c[5] + c[7]) / 8;
      const dx = c[6] + c[4] - c[2] - c[0],
        dy = c[7] + c[5] - c[3] - c[1];
      const l = Math.hypot(dx, dy);
      if (l === 0) continue;
      const nx = (dy / l) * e,
        ny = (-dx / l) * e;
      if (inPath(p, x + nx, y + ny) && inPath(p, x - nx, y - ny)) n++;
    }
  }
  return n;
}

const contourCount = (p: PolygonPath) => p.commands.filter((c) => c === PATH_M).length;

describe('mergeRegion', () => {
  it('joins two overlapping squares into one outline', () => {
    const src = pathFromD('M0 0 L10 0 L10 10 L0 10 Z M5 5 L15 5 L15 15 L5 15 Z');
    expect(edgesInsideFill(src, 0.01)).toBeGreaterThan(0);
    const m = mergeRegion(src);
    expect(contourCount(m)).toBe(1);
    expect(edgesInsideFill(m, 0.01)).toBe(0);
    expectSameRegion(src, m, 0.5);
  });

  it('keeps the curves of two overlapping circles', () => {
    const circle = (cx: number) =>
      `M${cx + 10} 0 A10 10 0 0 1 ${cx - 10} 0 A10 10 0 0 1 ${cx + 10} 0 Z`;
    const src = pathFromD(`${circle(0)} ${circle(12)}`);
    const m = mergeRegion(src);
    expect(contourCount(m)).toBe(1);
    expect(m.commands).toContain(PATH_C);
    expect(edgesInsideFill(m, 0.01)).toBe(0);
    expectSameRegion(src, m, 0.7);
  });

  it('drops a contour lying wholly inside the fill and keeps a hole', () => {
    const src = pathFromD('M0 0 L30 0 L30 30 L0 30 Z M5 5 L5 10 L10 10 L10 5 Z M20 20 L25 20 L25 25 L20 25 Z');
    const m = mergeRegion(src);
    expect(contourCount(m)).toBe(2);
    expectSameRegion(src, m, 0.5);
  });

  it('answers a path with nothing to cut unchanged', () => {
    const d = 'M0 0 L10 0 L10 10 L0 10 Z M3 3 L3 6 L6 6 L6 3 Z';
    expect(pathToD(mergeRegion(pathFromD(d)))).toBe(pathToD(pathFromD(d)));
  });

  it('leaves no edge inside the fill of a grown outline', () => {
    // A stem with a bowl meeting it at inside corners that do not cross when grown.
    const src = pathFromD('M0 0 L2 0 L2 4 C3 3 6 3 6 6 C6 9 3 9 2 8 L2 9 L0 9 Z');
    const grown = growRegion(src, 0.4, { tolerance: 0.001 });
    expect(edgesInsideFill(grown, 0.002), 'the grown outline has edges inside its fill').toBeGreaterThan(0);
    const m = mergeRegion(grown, { tolerance: 0.001 });
    expect(edgesInsideFill(m, 0.002)).toBe(0);
    expectSameRegion(grown, m, 0.13);
  });
});
