import { describe, it, expect } from 'vitest';
import type { Affine } from '@weasel-js/geom';
import { rectPath, transformPath } from 'domains/paths';
import { PATH_GEOMETRY_PROJECTION } from '../geometryProjection';

const FLIP_X: Affine = [-1, 0, 0, 1, 20, 0];
const unchanged = <T>(pose: T) => ({ from: pose, to: pose });

describe('PATH_GEOMETRY_PROJECTION', () => {
  it('carries data.path through the transform the pose took, keeping the rest of data', () => {
    const path = rectPath(0, 0, 10, 4);
    const pose = { x: 0, y: 0, width: 10, height: 4 };
    const out = PATH_GEOMETRY_PROJECTION.transform({ data: { path, fill: 'red' }, pose }, FLIP_X, unchanged(pose));
    expect(out).toEqual({ path: transformPath(path, FLIP_X), fill: 'red' });
  });

  it('leaves a node with no data.path alone', () => {
    const pose = { x: 0, y: 0, width: 10, height: 4 };
    expect(PATH_GEOMETRY_PROJECTION.transform({ data: { text: 'hi' }, pose }, FLIP_X, unchanged(pose))).toBeNull();
    expect(PATH_GEOMETRY_PROJECTION.transform({ data: undefined, pose }, FLIP_X, unchanged(pose))).toBeNull();
  });
});
