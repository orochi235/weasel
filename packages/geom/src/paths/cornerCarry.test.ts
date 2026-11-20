import { describe, expect, it } from 'vitest';
import { PATH_C, PATH_L, PATH_M, PATH_Z } from '../commands';
import type { PolygonPath } from '../path';
import { pathToAnchors } from './anchors';
import { flatAnchorIndices } from './cornerCarry';

describe('flatAnchorIndices', () => {
  it('numbers the subpath after an implicit open as pathToAnchors numbers its corners', () => {
    // The second subpath opens at the pen, (0, 0), and its closing curve ends there.
    // Written by hand: PathBuilder writes the `M` an implicit open leaves out.
    const path: PolygonPath = {
      kind: 'polygon',
      fillRule: 'nonzero',
      commands: new Uint8Array([PATH_M, PATH_L, PATH_Z, PATH_L, PATH_C, PATH_Z, PATH_M, PATH_L, PATH_L, PATH_Z]),
      coords: new Float32Array([0, 0, 10, 0, 20, 20, 30, 30, 10, 10, 0, 0, 50, 50, 60, 50, 60, 60]),
    };
    const corners = Array.from({ length: 7 }, (_, i) => ({ shape: 'round' as const, radius: i + 1 }));
    const { anchors } = pathToAnchors({ ...path, corners });
    const radii = anchors.flat().map((a) => a.corner?.radius ?? null);
    // Anchor commands: M, L, L(20,20), C (folds onto the uncounted pen start), M, L, L.
    expect(Array.from(flatAnchorIndices(path))).toEqual([0, 1, 2, -1, 3, 4, 5]);
    expect(radii).toEqual([1, 2, null, 3, 4, 5, 6]);
  });
});
