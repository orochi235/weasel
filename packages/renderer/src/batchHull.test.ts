import { describe, expect, it } from 'vitest';
import { mat3, pathFromD, type GlMat3 } from '@weasel-js/geom';
import { concatHulls, hullOf, snappedRectOf, windowMap, HULL_PLANES, type HullSet } from './batchHull';

/** An 800×600 frame at dpr 1, its projection as `u_proj` holds it. */
const MAP = windowMap(mat3.toUniform(mat3.screenToClip(800, 600)), [0, 0], 800, 600);
const ID: GlMat3 = mat3.toUniform(mat3.identity());

/** Whether the pixel whose center is (x + 0.5, y + 0.5) in window space
 *  (y up) is inside `set`, by the arithmetic the shader does. */
function inside(set: HullSet, x: number, y: number): boolean {
  for (let k = 0; k < set.count; k++) {
    const [a, b, c, w] = set.planes.subarray(4 * k, 4 * k + 4);
    const ox = (w % 32768) - 16384;
    const oy = Math.floor(w / 32768) - 16384;
    if (a * ((x - ox) * 16 + 8) + b * ((y - oy) * 16 + 8) + c < 0) return false;
  }
  return true;
}

describe('hullOf', () => {
  it('takes a turned rect as four planes', () => {
    const hull = hullOf(pathFromD('M 100 10 L 190 100 L 100 190 L 10 100 Z'), ID, MAP)!;
    expect(hull.set.count).toBe(4);
    // Screen (100, 100) is window (100, 500).
    expect(inside(hull.set, 100, 500)).toBe(true);
    expect(inside(hull.set, 15, 595)).toBe(false);
  });

  it('sends a tie on an edge the way the rasterizer does', () => {
    // A diamond whose edges run through pixel centers.
    const hull = hullOf(pathFromD('M 50.5 10.5 L 90.5 50.5 L 50.5 90.5 L 10.5 50.5 Z'), ID, MAP)!;
    // Window y = 600 - screen y. The center (30.5, 569.5) lies on the
    // upper-left edge, whose inside is toward +x, and is kept; (70.5, 569.5)
    // on the upper-right one, whose inside is toward -x, is not.
    expect(inside(hull.set, 30, 569)).toBe(true);
    expect(inside(hull.set, 70, 569)).toBe(false);
  });

  it('refuses a polygon that is not convex, and one with too many edges', () => {
    expect(hullOf(pathFromD('M 10 10 L 90 10 L 90 90 L 50 40 L 10 90 Z'), ID, MAP)).toBeNull();
    const star = pathFromD('M 50 0 L 61 35 L 98 35 L 68 57 L 79 91 L 50 70 L 21 91 L 32 57 L 2 35 L 39 35 Z');
    expect(hullOf(star, ID, MAP)).toBeNull();
    const pts = Array.from({ length: HULL_PLANES + 1 }, (_, i) => {
      const t = (2 * Math.PI * i) / (HULL_PLANES + 1);
      return `${i ? 'L' : 'M'} ${100 + 50 * Math.cos(t)} ${100 + 50 * Math.sin(t)}`;
    });
    expect(hullOf(pathFromD(`${pts.join(' ')} Z`), ID, MAP)).toBeNull();
  });

  it('refuses a pentagram, whose turns all go one way', () => {
    const pentagram = pathFromD('M 50 0 L 79 91 L 2 35 L 98 35 L 21 91 Z');
    expect(hullOf(pentagram, ID, MAP)).toBeNull();
  });

  it('keeps nothing for a clip that snaps to a line', () => {
    const hull = hullOf(pathFromD('M 10 10 L 90 10.01 L 10 10.02 Z'), ID, MAP)!;
    expect(inside(hull.set, 10, 590)).toBe(false);
    expect(inside(hull.set, 400, 300)).toBe(false);
  });

  it('builds a clip that stays put once', () => {
    const path = pathFromD('M 100 10 L 190 100 L 100 190 L 10 100 Z');
    expect(hullOf(path, ID, MAP)).toBe(hullOf(path, ID, { ...MAP }));
    expect(hullOf(path, ID, MAP)).not.toBe(hullOf(path, mat3.toUniform(mat3.translated(mat3.identity(), 1, 0)), MAP));
  });

  it('nests up to the plane budget', () => {
    const a = hullOf(pathFromD('M 100 10 L 190 100 L 100 190 L 10 100 Z'), ID, MAP)!.set;
    const both = concatHulls(a, a)!;
    expect(both.count).toBe(8);
    expect(concatHulls(both, a)).toBeNull();
  });
});

describe('snappedRectOf', () => {
  const rect = (x: number, y: number, width: number, height: number) => ({ kind: 'rect' as const, x, y, width, height });

  it('moves a rect clip\'s edges to the nearest sixteenth of a pixel', () => {
    const { rect: r } = snappedRectOf(rect(10.03, 20.47, 30.5, 9.99), ID, MAP)!;
    expect(r).toEqual({ x0: 10, y0: 20.5, x1: 40.5, y1: 30.4375 });
  });

  it('keeps the pixel centers its hull keeps, ties going the rasterizer\'s way', () => {
    // Edges through pixel centers and a sixteenth either side of them.
    for (const [x, y, w, h] of [[10.5, 20.5, 7, 5], [10.5625, 20.4375, 6.875, 5.125], [3.97, 8.03, 4.06, 3.94]]) {
      const { rect: r, hull } = snappedRectOf(rect(x, y, w, h), ID, MAP)!;
      for (let px = 0; px < 24; px++) {
        for (let py = 0; py < 32; py++) {
          // A screen pixel center; window y = 600 - screen y. The left and
          // bottom-in-window (bottom-on-screen) edges keep a center on them.
          const cx = px + 0.5;
          const cy = py + 0.5;
          const kept = cx >= r.x0 && cx < r.x1 && cy > r.y0 && cy <= r.y1;
          expect(inside(hull.set, px, 599 - py)).toBe(kept);
        }
      }
    }
  });

  it('declines a window map that turns the axes', () => {
    expect(snappedRectOf(rect(0, 0, 10, 10), ID, { ...MAP, bx: 1 })).toBeNull();
  });
});
