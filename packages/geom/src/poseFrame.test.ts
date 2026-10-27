import { describe, expect, it } from 'vitest';
import { applyToPoint, rotateAboutPoint } from '@weasel-js/geom';
import { boxFrameOf, poseFrameInverseOf, poseFrameOf, poseLinearOf } from './poseFrame';

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
    expect(applyToPoint(frame, 30, 30)).toEqual([30, 30]);
    expect(applyToPoint(frame, 10, 20)).toEqual([-10, 25]);
    expect(applyToPoint(frame, 50, 40)).toEqual([70, 35]);
  });

  it('applies the transform inside the rotation', () => {
    const frame = poseFrameOf({ ...BOX, rotation: Math.PI / 2, transform: [2, 0, 0, 1] })!;
    // (50, 30) is 20 right of center: stretched to 40, then turned to point down.
    const [x, y] = applyToPoint(frame, 50, 30);
    expect(x).toBeCloseTo(30, 9);
    expect(y).toBeCloseTo(70, 9);
  });
});

describe('poseFrameInverseOf', () => {
  it('undoes the frame', () => {
    const pose = { ...BOX, rotation: 0.3, transform: [1, 0, 0.5, 1] as const };
    const [wx, wy] = applyToPoint(poseFrameOf(pose)!, 17, 23);
    const [lx, ly] = applyToPoint(poseFrameInverseOf(pose)!, wx, wy);
    expect(lx).toBeCloseTo(17, 9);
    expect(ly).toBeCloseTo(23, 9);
  });

  it('is null for a singular transform', () => {
    expect(poseFrameInverseOf({ ...BOX, transform: [1, 0, 0, 0] })).toBeNull();
  });
});

describe('boxFrameOf', () => {
  it('puts the origin of the box\'s own coordinates on its corner', () => {
    expect(applyToPoint(boxFrameOf(BOX)!, 0, 0)).toEqual([10, 20]);
    expect(applyToPoint(boxFrameOf(BOX)!, 40, 20)).toEqual([50, 40]);
  });

  it('turns them with the box, about its center', () => {
    const frame = boxFrameOf({ ...BOX, rotation: Math.PI / 2 })!;
    // The corner is (-20, -10) from the center (30, 30); a quarter turn
    // carries that to (10, -20).
    const [x, y] = applyToPoint(frame, 0, 0);
    expect(x).toBeCloseTo(40, 9);
    expect(y).toBeCloseTo(10, 9);
  });

  it('is null for a pose that is not a box', () => {
    expect(boxFrameOf({ rotation: 1 })).toBeNull();
    expect(boxFrameOf(undefined)).toBeNull();
  });
});
