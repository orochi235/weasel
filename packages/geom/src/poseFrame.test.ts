import { describe, expect, it } from 'vitest';
import { transformPoint, polygonFromPoints, resolveCorners, rotateAboutPoint, transformPath, type PolygonPath } from '@weasel-js/geom';
import {
  boxFrameOf, pathThroughPoseFrame, poseFrameInverseOf, poseFrameOf, poseLinearOf, type PoseLinear,
} from './poseFrame';

const BOX = { x: 10, y: 20, width: 40, height: 20 };

describe('poseFrameOf', () => {
  it('is null for a box with no rotation and no transform', () => {
    expect(poseFrameOf(BOX)).toBeNull();
    expect(poseFrameOf({ ...BOX, rotation: 0, transform: [1, 0, 0, 1] })).toBeNull();
    expect(poseLinearOf({ ...BOX, transform: [1, 0, 0, 1] })).toBeNull();
  });

  it('is null for a pose that is not a box', () => {
    expect(poseFrameOf({ rotation: 1, transform: [2, 0, 0, 1] })).toBeNull();
    expect(poseFrameOf(null)).toBeNull();
  });

  it('is the rotation about the box center when there is no transform', () => {
    expect(poseFrameOf({ ...BOX, rotation: 0.5 })).toEqual(rotateAboutPoint(30, 30, 0.5));
  });

  it('applies the transform about the box center', () => {
    const frame = poseFrameOf({ ...BOX, transform: [2, 0, 0, 0.5] })!;
    expect(transformPoint(frame, 30, 30)).toEqual([30, 30]);
    expect(transformPoint(frame, 10, 20)).toEqual([-10, 25]);
    expect(transformPoint(frame, 50, 40)).toEqual([70, 35]);
  });

  it('applies the transform inside the rotation', () => {
    const frame = poseFrameOf({ ...BOX, rotation: Math.PI / 2, transform: [2, 0, 0, 1] })!;
    // (50, 30) is 20 right of center: stretched to 40, then turned to point down.
    const [x, y] = transformPoint(frame, 50, 30);
    expect(x).toBeCloseTo(30, 9);
    expect(y).toBeCloseTo(70, 9);
  });
});

describe('poseFrameInverseOf', () => {
  it('undoes the frame', () => {
    const pose = { ...BOX, rotation: 0.3, transform: [1, 0, 0.5, 1] as const };
    const [wx, wy] = transformPoint(poseFrameOf(pose)!, 17, 23);
    const [lx, ly] = transformPoint(poseFrameInverseOf(pose)!, wx, wy);
    expect(lx).toBeCloseTo(17, 9);
    expect(ly).toBeCloseTo(23, 9);
  });

  it('is null for a singular transform', () => {
    expect(poseFrameInverseOf({ ...BOX, transform: [1, 0, 0, 0] })).toBeNull();
  });
});

describe('boxFrameOf', () => {
  it('puts the origin of the box\'s own coordinates on its corner', () => {
    expect(transformPoint(boxFrameOf(BOX)!, 0, 0)).toEqual([10, 20]);
    expect(transformPoint(boxFrameOf(BOX)!, 40, 20)).toEqual([50, 40]);
  });

  it('turns them with the box, about its center', () => {
    const frame = boxFrameOf({ ...BOX, rotation: Math.PI / 2 })!;
    // The corner is (-20, -10) from the center (30, 30); a quarter turn
    // carries that to (10, -20).
    const [x, y] = transformPoint(frame, 0, 0);
    expect(x).toBeCloseTo(40, 9);
    expect(y).toBeCloseTo(10, 9);
  });

  it('is null for a pose that is not a box', () => {
    expect(boxFrameOf({ rotation: 1 })).toBeNull();
    expect(boxFrameOf(undefined)).toBeNull();
  });
});

describe('pathThroughPoseFrame on rounded corners', () => {
  const round = { shape: 'round', radius: 10 } as const;
  const box = {
    ...polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]),
    corners: [round, round, round, round],
  } as PolygonPath;
  const pose = (transform: PoseLinear) => ({ x: 0, y: 0, width: 100, height: 100, transform });

  it('rounds corners in the box frame before a stretch or skew, as the renderer draws them', () => {
    for (const t of [[4, 0, 0, 1], [1, 0.7, 0, 1]] as PoseLinear[]) {
      const framed = pathThroughPoseFrame(box, pose(t)) as PolygonPath;
      const drawn = transformPath(resolveCorners(box), poseFrameOf(pose(t))!) as PolygonPath;
      expect(framed.corners).toBeUndefined();
      expect(Array.from(framed.commands)).toEqual(Array.from(drawn.commands));
      Array.from(drawn.coords).forEach((v, i) => expect(framed.coords[i]).toBeCloseTo(v, 4));
    }
  });

  it('keeps corners as corners under a uniform frame', () => {
    const framed = pathThroughPoseFrame(box, pose([2, 0, 0, 2])) as PolygonPath;
    expect(framed).toEqual(transformPath(box, poseFrameOf(pose([2, 0, 0, 2]))!));
    expect(framed.corners).toBeDefined();
    expect((pathThroughPoseFrame(box, { ...pose([1, 0, 0, 1]), rotation: 0.6 }) as PolygonPath).corners).toBeDefined();
  });
});
