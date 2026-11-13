import { describe, it, expect } from 'vitest';
import { pathSignedArea } from '../paths/winding';
import { boundsOfPath } from '../paths/bounds';
import { PATH_M, PATH_Z } from '../commands';
import { worldCoords } from '../paths/pathOrigin';
import type { PolygonPath } from '../path';
import { trianglesToPath } from './trianglesToPath';

describe('trianglesToPath', () => {
  it('joins triangles sharing an edge into one contour', () => {
    const out = trianglesToPath(new Float32Array([0, 0, 10, 0, 10, 10, 0, 10]), new Uint32Array([0, 1, 2, 0, 2, 3]));
    expect(Math.abs(pathSignedArea(out))).toBeCloseTo(100, 6);
    // One closed square: M + 3 L + Z.
    expect(out.commands.length).toBe(5);
  });

  it('counts an overlap once', () => {
    const out = trianglesToPath(
      new Float32Array([0, 0, 10, 0, 0, 10, 0, 0, 10, 0, 10, 10]),
      new Uint32Array([0, 1, 2, 3, 4, 5]),
    );
    // Two right triangles of area 50 sharing a quarter of the square.
    expect(Math.abs(pathSignedArea(out))).toBeCloseTo(75, 6);
    expect(boundsOfPath(out)).toMatchObject({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('skips triangles with no area, and answers an empty path for none', () => {
    const flat = trianglesToPath(new Float32Array([0, 0, 5, 0, 10, 0]), new Uint32Array([0, 1, 2]));
    expect(flat.commands.length).toBe(0);
    expect(trianglesToPath(new Float32Array(0), new Uint32Array(0)).commands.length).toBe(0);
  });

  it('keeps the hole a ring of triangles surrounds, whichever way each winds', () => {
    // A 30×30 frame around a 10×10 hole, as eight triangles, every other one wound clockwise.
    const v = new Float32Array([0, 0, 30, 0, 30, 30, 0, 30, 10, 10, 20, 10, 20, 20, 10, 20]);
    const idx = new Uint32Array([0, 1, 5, 0, 4, 5, 1, 2, 6, 1, 5, 6, 2, 3, 7, 2, 6, 7, 3, 0, 4, 3, 7, 4]);
    const out = trianglesToPath(v, idx);
    expect(Math.abs(pathSignedArea(out))).toBeCloseTo(800, 6);
    expect(out.commands.filter((c) => c === PATH_M)).toHaveLength(2);
  });

  it('unions separate pieces that overlap', () => {
    const out = trianglesToPath(
      new Float32Array([0, 0, 10, 0, 10, 10, 0, 10, 5, 5, 15, 5, 15, 15, 5, 15, 40, 0, 50, 0, 50, 10]),
      new Uint32Array([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10]),
    );
    expect(Math.abs(pathSignedArea(out))).toBeCloseTo(175 + 50, 6);
    expect(out.commands.filter((c) => c === PATH_M)).toHaveLength(2);
  });

  it('leaves no crack where vertices sit on another triangle\'s edge only to float32 precision', () => {
    // a–c is one triangle's edge; the fan on its other side meets it at points
    // on it in exact arithmetic, which land a hair either side once stored as float32.
    const verts = [0, 0, 100, 0, 100, 70.3, 0, 70.3];
    const idx = [0, 1, 2];
    let prev = 0;
    for (let k = 1; k <= 13; k++) {
      const at = k === 13 ? 2 : verts.push((100 * k) / 13, (70.3 * k) / 13) / 2 - 1;
      idx.push(prev, at, 3);
      prev = at;
    }
    const out = trianglesToPath(new Float32Array(verts), new Uint32Array(idx));
    expect(Math.abs(pathSignedArea(out))).toBeCloseTo(7030, 2);
    expect(out.commands.filter((c) => c === PATH_M)).toHaveLength(1);
  });

  it('fills exactly what a pile of long, crossing triangles covers', () => {
    // Slabs through one small spot at every angle, as a wide stroke's ribbon lays them: each crosses every other.
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const verts: number[] = [], idx: number[] = [];
    for (let k = 0; k < 60; k++) {
      const a = rnd() * Math.PI * 2, r = 1000, cx = rnd() * 4, cy = rnd() * 4, w = 0.5 + rnd() * 3;
      const ux = Math.cos(a) * r, uy = Math.sin(a) * r, nx = -Math.sin(a) * w, ny = Math.cos(a) * w;
      const at = verts.length / 2;
      verts.push(cx - ux - nx, cy - uy - ny, cx + ux - nx, cy + uy - ny, cx + ux + nx, cy + uy + ny, cx - ux + nx, cy - uy + ny);
      idx.push(at, at + 1, at + 2, at, at + 2, at + 3);
    }
    const v = new Float32Array(verts);
    const out = trianglesToPath(v, new Uint32Array(idx));
    for (let s = 0; s < 4000; s++) {
      // Half the points near the spot, where the slabs cross, and half anywhere they reach.
      const reach = s % 2 === 0 ? 20 : 1000;
      const x = (rnd() - 0.5) * 2 * reach, y = (rnd() - 0.5) * 2 * reach;
      expect(fills(out, x, y), `${x}, ${y}`).toBe(covers(v, idx, x, y));
    }
  });
});

/** Whether a triangle of the mesh holds `(x, y)`. */
function covers(v: Float32Array, idx: number[], x: number, y: number): boolean {
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t]! * 2, idx[t + 1]! * 2, idx[t + 2]! * 2];
    const d1 = (v[b]! - v[a]!) * (y - v[a + 1]!) - (v[b + 1]! - v[a + 1]!) * (x - v[a]!);
    const d2 = (v[c]! - v[b]!) * (y - v[b + 1]!) - (v[c + 1]! - v[b + 1]!) * (x - v[b]!);
    const d3 = (v[a]! - v[c]!) * (y - v[c + 1]!) - (v[a + 1]! - v[c + 1]!) * (x - v[c]!);
    if ((d1 > 0 && d2 > 0 && d3 > 0) || (d1 < 0 && d2 < 0 && d3 < 0)) return true;
  }
  return false;
}

/** Whether `path` fills `(x, y)` under the nonzero rule. */
function fills(path: PolygonPath, x: number, y: number): boolean {
  const p = worldCoords(path);
  let w = 0, start = 0, k = 0;
  const edge = (ax: number, ay: number, bx: number, by: number): void => {
    if ((ay > y) === (by > y)) return;
    if (ax + ((y - ay) / (by - ay)) * (bx - ax) > x) w += by > ay ? 1 : -1;
  };
  for (const c of path.commands) {
    if (c === PATH_M) { start = k; k += 2; } else if (c === PATH_Z) edge(p[k - 2]!, p[k - 1]!, p[start]!, p[start + 1]!);
    else { edge(p[k - 2]!, p[k - 1]!, p[k]!, p[k + 1]!); k += 2; }
  }
  return w !== 0;
}
