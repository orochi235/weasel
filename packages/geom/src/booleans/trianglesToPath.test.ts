import { describe, it, expect } from 'vitest';
import { pathSignedArea } from '../paths/winding';
import { boundsOfPath } from '../paths/bounds';
import { PATH_M } from '../commands';
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
});
