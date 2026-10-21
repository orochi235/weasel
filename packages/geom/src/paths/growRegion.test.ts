import { describe, it, expect } from 'vitest';
import { PATH_C, PATH_L } from '../commands';
import type { Path } from '../path';
import { pointInPath } from '../pathHitTest';
import { boundsOfPath } from './bounds';
import { growRegion } from './growRegion';
import { pathDistanceToPoint } from './pathDistance';
import { pathFromD } from './pathFromD';

/** Hit-tests against the curves themselves, not the default half-unit flattening. */
const inPath = (p: Path, x: number, y: number) => pointInPath(p, x, y, { tolerance: 1e-4 });

/** Every grid point whose distance from the region's edge is clear of `d` by
 *  `slack` lands where the true offset puts it: inside the region or within
 *  `d` of it is filled, anything else is not. */
function expectGrownByDistance(d: string, dist: number, slack: number, step: number): void {
  const src = pathFromD(d);
  const grown = growRegion(src, dist, { join: 'round', tolerance: slack / 4 });
  const b = boundsOfPath(src);
  let checked = 0;
  for (let y = b.y - dist * 2; y <= b.y + b.height + dist * 2; y += step) {
    for (let x = b.x - dist * 2; x <= b.x + b.width + dist * 2; x += step) {
      const inside = inPath(src, x, y);
      const edge = pathDistanceToPoint(src, x, y);
      if (!inside && Math.abs(edge - dist) < slack) continue;
      checked++;
      const want = inside || edge <= dist;
      if (inPath(grown, x, y) !== want) {
        throw new Error(`(${x}, ${y}) filled=${!want}, distance ${edge}, inside ${inside}`);
      }
    }
  }
  expect(checked).toBeGreaterThan(100);
}

describe('growRegion', () => {
  it('moves each edge of a square out by the distance and miters its corners', () => {
    const g = growRegion(pathFromD('M0 0 L10 0 L10 10 L0 10 Z'), 1);
    expect(boundsOfPath(g)).toMatchObject({
      x: -1,
      y: -1,
      width: 12,
      height: 12,
    });
    expect(inPath(g, -0.95, -0.95)).toBe(true);
  });

  it('rounds the corners under a round join', () => {
    const g = growRegion(pathFromD('M0 0 L10 0 L10 10 L0 10 Z'), 1, {
      join: 'round',
    });
    expect(boundsOfPath(g).width).toBeCloseTo(12, 5);
    expect(inPath(g, -0.9, -0.9)).toBe(false);
    expect(inPath(g, -0.6, -0.6)).toBe(true);
  });

  it('grows the same either way a region is wound', () => {
    const cw = growRegion(pathFromD('M0 0 L0 10 L10 10 L10 0 Z'), 1);
    expect(boundsOfPath(cw)).toMatchObject({
      x: -1,
      y: -1,
      width: 12,
      height: 12,
    });
  });

  it('shrinks a hole, and fills one grown shut', () => {
    const ring = 'M0 0 L10 0 L10 10 L0 10 Z M3 3 L3 7 L7 7 L7 3 Z';
    expect(inPath(growRegion(pathFromD(ring), 1), 5, 5)).toBe(false);
    expect(inPath(growRegion(pathFromD(ring), 1), 3.5, 5)).toBe(true);
    expect(inPath(growRegion(pathFromD(ring), 2.5), 5, 5)).toBe(true);
  });

  it('trims two straight edges meeting at an inside corner to where they cross', () => {
    const g = growRegion(pathFromD('M0 0 L10 0 L10 4 L4 4 L4 10 L0 10 Z'), 1);
    // Six edges and nothing else: mitered outside corners and the trimmed inside one add no anchor.
    expect(Array.from(g.commands).filter((c) => c === PATH_L).length).toBe(6);
    expect(inPath(g, 4.5, 4.5)).toBe(true);
    expect(inPath(g, 5.5, 5.5)).toBe(false);
  });

  it('trims a curve and a line meeting at an inside corner rather than looping through it', () => {
    const d = 'M0 0 L10 0 L10 4 C8 4 6 3.5 4 4 L4 10 L0 10 Z';
    const g = growRegion(pathFromD(d), 1);
    const xs = Array.from(g.coords);
    for (let i = 0; i < xs.length; i += 2) expect(Math.hypot(xs[i]! - 4, xs[i + 1]! - 4)).toBeGreaterThan(0.5);
    expectGrownByDistance(d, 1, 0.1, 0.23);
  });

  it('keeps a circle a curve, within the tolerance', () => {
    const k = 0.5522847498 * 10;
    const circle = `M10 0 C10 ${k} ${k} 10 0 10 C${-k} 10 -10 ${k} -10 0 C-10 ${-k} ${-k} -10 0 -10 C${k} -10 10 ${-k} 10 0 Z`;
    const g = growRegion(pathFromD(circle), 2, { tolerance: 0.01 });
    // No lines at all, and at most one split per quarter.
    expect(Array.from(g.commands).filter((c) => c === PATH_L)).toHaveLength(0);
    expect(Array.from(g.commands).filter((c) => c === PATH_C).length).toBeLessThanOrEqual(8);
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      expect(inPath(g, Math.cos(a) * 11.95, Math.sin(a) * 11.95)).toBe(true);
      expect(inPath(g, Math.cos(a) * 12.05, Math.sin(a) * 12.05)).toBe(false);
    }
  });

  it('fills exactly the points within the distance of a region with curves, holes, and inside corners', () => {
    expectGrownByDistance('M0 0 L20 0 L20 6 Q12 6 12 14 L12 20 L0 20 Z M4 4 L4 9 L9 9 L9 4 Z', 1.5, 0.1, 0.37);
    expectGrownByDistance('M0 0 C8 -6 16 6 24 0 L24 3 C16 9 8 -3 0 3 Z', 0.8, 0.08, 0.21);
  });

  it('answers an empty path for no growth', () => {
    expect(growRegion(pathFromD('M0 0 L1 0 L1 1 Z'), 0).commands.length).toBe(0);
  });
});
