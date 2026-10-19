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
