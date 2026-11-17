import { describe, expect, it } from 'vitest';
import { jointAxes, skeletonAxes } from './rig/skeletonAxes';
import { IDENTITY_JOINT, type Pose, type Skeleton } from './rig/types';
import { createTarget } from './target';

const skeleton: Skeleton = {
  joints: ['hip', 'knee'].map((name) => ({ name, parent: null, bind: { ...IDENTITY_JOINT } })),
};

describe('target.axisIndexes', () => {
  it("answers a plain object's fields by name, wherever its axes put them", () => {
    const target = createTarget({ get: () => ({ y: 1, x: 2, alpha: 3 }), set: () => {} });
    expect(target.axes.names).toEqual(['alpha', 'x', 'y']);
    expect(target.axisIndexes(['y'])).toEqual([2]);
    expect(target.axisIndexes(['y', 'alpha'])).toEqual([2, 0]);
  });

  it('passes indexes through beside names', () => {
    const target = createTarget({ get: () => ({ x: 0, y: 0 }), set: () => {} });
    expect(target.axisIndexes([1, 'x'])).toEqual([1, 0]);
  });

  it('answers every axis under a path, and one axis by its full name', () => {
    const target = createTarget<Pose>({ get: () => ({}), set: () => {}, axes: skeletonAxes(skeleton) });
    expect(target.axisIndexes(['knee'])).toEqual([5, 6, 7, 8, 9]);
    expect(target.axisIndexes(['knee.rotation', 'hip.x'])).toEqual([7, 0]);
  });

  it('refuses a name no axis has, an index out of range, and a name on axes with none', () => {
    const point = createTarget({ get: () => ({ x: 0, y: 0 }), set: () => {} });
    // @ts-expect-error a point has no field `z`
    expect(() => point.axisIndexes(['z'])).toThrow(/`axes` names "z".*"x", "y"/);
    expect(() => point.axisIndexes([2])).toThrow(/names axis 2 of a target with 2/);
    const list = createTarget({ get: () => [0, 0], set: () => {} });
    // @ts-expect-error an array's axes have indexes only
    expect(() => list.axisIndexes(['x'])).toThrow(/`axes` names "x" on a target whose axes have no names/);
  });
});

describe('target.axisIndexes: names holding a dot', () => {
  const dotted: Skeleton = {
    joints: ['spine', 'spine.001', 'arm', 'arm.x'].map((name) => ({ name, parent: null, bind: { ...IDENTITY_JOINT } })),
  };

  it("answers a joint's own axes, not those of a joint whose name extends it by a dot", () => {
    const target = createTarget<Pose>({ get: () => ({}), set: () => {}, axes: skeletonAxes(dotted) });
    expect(target.axisIndexes(['spine'])).toEqual([0, 1, 2, 3, 4]);
    expect(target.axisIndexes(['spine.001'])).toEqual([5, 6, 7, 8, 9]);
    expect(target.axisIndexes(['spine.001.rotation'])).toEqual([7]);
    expect(jointAxes(dotted, ['spine'])).toEqual([0, 1, 2, 3, 4]);
  });

  it('refuses a name that is both one axis and the start of others', () => {
    const target = createTarget<Pose>({ get: () => ({}), set: () => {}, axes: skeletonAxes(dotted) });
    expect(() => target.axisIndexes(['arm.x'])).toThrow(/both an axis/);
    expect(() => jointAxes(dotted, ['arm.x'])).toThrow(/both an axis/);
  });

  it("does not read a dot in a plain object's field as a path", () => {
    const target = createTarget({ get: () => ({ a: 1, 'a.b': 2 }), set: () => {} });
    expect(target.axisIndexes(['a'])).toEqual([0]);
    expect(target.axisIndexes(['a.b'])).toEqual([1]);
  });
});
