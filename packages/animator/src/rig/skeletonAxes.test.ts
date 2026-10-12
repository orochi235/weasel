import { describe, expect, it } from 'vitest';
import { jointAxes, skeletonAxes } from './skeletonAxes';
import { IDENTITY_JOINT, type Skeleton } from './types';

const skeleton: Skeleton = {
  joints: [
    { name: 'hip', parent: null, bind: { ...IDENTITY_JOINT } },
    { name: 'knee', parent: 'hip', bind: { ...IDENTITY_JOINT, x: 10 } },
  ],
};

describe('skeletonAxes', () => {
  it('lays out five axes a joint in skeleton order, each rotation an angle', () => {
    const axes = skeletonAxes(skeleton);
    expect(axes.count).toBe(10);
    expect(axes.angles).toEqual([2, 7]);
    expect(axes.to({ knee: { x: 1, y: 2, rotation: 3, scaleX: 4, scaleY: 5 }, hip: { x: 6, y: 7, rotation: 8, scaleX: 9, scaleY: 10 } }))
      .toEqual([6, 7, 8, 9, 10, 1, 2, 3, 4, 5]);
  });

  it('fills an absent joint or field with its identity', () => {
    expect(skeletonAxes(skeleton).to({ knee: { rotation: 0.5 } })).toEqual([0, 0, 0, 1, 1, 0, 0, 0.5, 1, 1]);
    expect(skeletonAxes(skeleton).to({})).toEqual([0, 0, 0, 1, 1, 0, 0, 0, 1, 1]);
  });

  it('builds a full pose back', () => {
    expect(skeletonAxes(skeleton).from([6, 7, 8, 9, 10, 1, 2, 3, 4, 5])).toEqual({
      hip: { x: 6, y: 7, rotation: 8, scaleX: 9, scaleY: 10 },
      knee: { x: 1, y: 2, rotation: 3, scaleX: 4, scaleY: 5 },
    });
  });
});

describe('jointAxes', () => {
  it("answers the named joints' axes, in the order they are named", () => {
    expect(jointAxes(skeleton, ['knee'])).toEqual([5, 6, 7, 8, 9]);
    expect(jointAxes(skeleton, ['knee', 'hip'])).toEqual([5, 6, 7, 8, 9, 0, 1, 2, 3, 4]);
  });

  it('refuses a joint the skeleton does not have', () => {
    expect(() => jointAxes(skeleton, ['elbow'])).toThrow(/elbow/);
  });
});
