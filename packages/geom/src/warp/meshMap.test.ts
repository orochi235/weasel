import { describe, expect, it } from 'vitest';
import { meshLocator } from './meshMap';

describe('meshLocator', () => {
  it('gives a point off the mesh the nearest triangle, not the one it is least outside in weight terms', () => {
    const mesh = {
      vertices: Float64Array.from([0, 0, 1, 0, 0, 1, 10, 0, 110, 0, 10, 100]),
      triangles: Uint32Array.from([0, 1, 2, 3, 4, 5]),
    };
    expect(meshLocator(mesh)(-1, 0.2)?.tri).toBe(0);
  });

});
