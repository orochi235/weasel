import { describe, expect, it } from 'vitest';
import { PATH_L, PATH_M, PATH_Z, pathToAnchors, type Affine, type PolygonPath } from '@weasel-js/geom';
import { editedPathSymmetries } from './symmetry';

/** A triangle mirror-symmetric about x = `c`, its coords stored as float32 with no origin. */
function triangleAbout(c: number): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([c - 10, 0, c + 10, 0, c, 50]),
    fillRule: 'nonzero',
  };
}

const mirrorAbout = (c: number): Affine => [-1, 0, 0, 1, 2 * c, 0];

describe('editedPathSymmetries', () => {
  it('finds a mirror far from the origin, where float32 rounding parts an anchor from its image', () => {
    for (const c of [0.3, 20000.3, 300000.3]) {
      const dep = { transforms: () => [mirrorAbout(c)] };
      expect(editedPathSymmetries(dep, 'p', pathToAnchors(triangleAbout(c))), String(c)).toHaveLength(1);
    }
  });

  it('still tells a path that is not its own image', () => {
    const dep = { transforms: () => [mirrorAbout(20000.3)] };
    expect(editedPathSymmetries(dep, 'p', pathToAnchors(triangleAbout(20000.35)))).toEqual([]);
  });
});
