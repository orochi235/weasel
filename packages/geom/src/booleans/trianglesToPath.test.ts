import { describe, it, expect } from 'vitest';
import { pathSignedArea } from '../paths/winding';
import { boundsOfPath } from '../paths/bounds';
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
});
