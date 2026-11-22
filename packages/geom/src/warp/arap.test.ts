import { describe, expect, it } from 'vitest';
import { createArapSolver, type ArapStep } from './arap';

describe('createArapSolver', () => {
  it('places a pinned vertex no triangle uses on its target', () => {
    const mesh = {
      vertices: Float64Array.from([0, 0, 10, 0, 0, 10, 50, 50]),
      triangles: Uint32Array.from([0, 1, 2]),
    };
    const at = createArapSolver(mesh, [0, 1, 3]).solve([5, 0, 15, 0, 70, 40]);
    expect([at[6], at[7]]).toEqual([70, 40]);
  });
});
