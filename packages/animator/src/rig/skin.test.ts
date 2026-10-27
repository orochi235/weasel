import { describe, expect, it } from 'vitest';
import {
  PATH_C, PATH_M, PATH_Z, PathBuilder, polygonFromPoints, worldCoords, type PolygonPath,
} from '@weasel-js/geom';
import { resolveSkeleton } from './resolveSkeleton';
import { motionsFromRest, skinPath } from './skin';
import { IDENTITY_JOINT, type Pose, type Skeleton } from './types';

const j = (name: string, parent: string | null, x = 0, y = 0) => ({
  name, parent, bind: { ...IDENTITY_JOINT, x, y },
});

/** shoulder at the origin, elbow 100 along x, wrist 100 further. */
const ARM: Skeleton = { joints: [j('shoulder', null), j('elbow', 'shoulder', 100), j('wrist', 'elbow', 100)] };

const motions = (pose: Pose) => motionsFromRest(ARM, resolveSkeleton(ARM, pose));
const QUARTER: Pose = { elbow: { rotation: Math.PI / 2 } };

const points = (path: PolygonPath): number[][] => {
  const out: number[][] = [];
  for (let i = 0; i < path.coords.length; i += 2) out.push([path.coords[i], path.coords[i + 1]]);
  return out;
};
const close = (got: number[], want: number[]) => {
  expect(got[0]).toBeCloseTo(want[0], 4);
  expect(got[1]).toBeCloseTo(want[1], 4);
};

describe('motionsFromRest', () => {
  it('is the identity for every joint at the bind pose', () => {
    for (const m of motions({}).values()) {
      expect(Array.from(m)).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    }
  });
});

describe('skinPath', () => {
  const line = polygonFromPoints([{ x: 50, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 0 }]);

  it('moves a point weighted wholly to one joint rigidly with it', () => {
    const out = points(skinPath(line, { shoulder: [1, 0, 0], elbow: [0, 1, 1] }, motions(QUARTER)));
    close(out[0], [50, 0]);
    close(out[1], [100, 0]);
    close(out[2], [100, 50]);
  });

  it('skins a path measured from an origin where the origin puts it, and keeps the origin', () => {
    const measured = new PathBuilder().setOrigin(40, 0).moveTo(50, 0).lineTo(100, 0).lineTo(150, 0).build();
    const out = skinPath(measured, { shoulder: [1, 0, 0], elbow: [0, 1, 1] }, motions(QUARTER));
    expect(out.origin).toEqual({ x: 40, y: 0 });
    const world = worldCoords(out);
    close([world[4], world[5]], [100, 50]);
  });

  it('puts a point between where each of its joints alone would carry it, by weight', () => {
    const out = points(skinPath(line, { shoulder: [0, 0, 0.25], elbow: [0, 0, 0.75] }, motions(QUARTER)));
    close(out[2], [0.25 * 150 + 0.75 * 100, 0.75 * 50]);
  });

  it('normalizes the weights on a point', () => {
    const out = points(skinPath(line, { shoulder: [0, 0, 1], elbow: [0, 0, 3] }, motions(QUARTER)));
    close(out[2], [0.25 * 150 + 0.75 * 100, 0.75 * 50]);
  });

  it('leaves a point no joint weighs at rest, a short weight array included', () => {
    const out = points(skinPath(line, { elbow: [0, 1] }, motions(QUARTER)));
    close(out[0], [50, 0]);
    close(out[2], [150, 0]);
  });

  it('blends curve handles as points and keeps the commands', () => {
    const curve: PolygonPath = {
      kind: 'polygon',
      commands: new Uint8Array([PATH_M, PATH_C, PATH_Z]),
      coords: new Float32Array([100, 0, 120, 0, 140, 0, 160, 0]),
      fillRule: 'evenodd',
    };
    const before = Array.from(curve.coords);
    const out = skinPath(curve, { elbow: [1, 1, 1, 1] }, motions(QUARTER));
    expect(out.commands).toBe(curve.commands);
    expect(out.fillRule).toBe('evenodd');
    expect(out.coords).not.toBe(curve.coords);
    expect(Array.from(curve.coords)).toEqual(before);
    close(points(out)[1], [100, 20]);
    close(points(out)[3], [100, 60]);
  });

  it('skins a rect as its four corners, clockwise from the top left', () => {
    const out = skinPath(
      { kind: 'rect', x: 100, y: -10, width: 50, height: 20 },
      { elbow: [1, 1, 1, 1] },
      motions(QUARTER),
    );
    expect(out.kind).toBe('polygon');
    const p = points(out);
    expect(p).toHaveLength(4);
    close(p[0], [110, 0]);
    close(p[1], [110, 50]);
    close(p[2], [90, 50]);
    close(p[3], [90, 0]);
  });

  it('throws on a joint the motions do not hold', () => {
    expect(() => skinPath(line, { knee: [1, 1, 1] }, motions({}))).toThrow(/knee/);
  });
});
