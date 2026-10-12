import { describe, expect, it } from 'vitest';
import { mat3 } from '@weasel-js/geom';
import { resolveSkeleton } from './resolveSkeleton';
import { addJoint, dropSkinJoints, jointAt, jointPositions, moveJoint, removeJoint } from './skeletonEdits';
import { IDENTITY_JOINT, type Skeleton } from './types';

const j = (name: string, parent: string | null, x = 0, y = 0, rotation = 0) => ({
  name, parent, bind: { ...IDENTITY_JOINT, x, y, rotation },
});

/** hip at (100, 100) turned a quarter, so its children's +x runs down the page. */
const LEG: Skeleton = { joints: [j('hip', null, 100, 100, Math.PI / 2), j('knee', 'hip', 50), j('foot', 'knee', 40)] };

const at = (s: Skeleton, name: string) => mat3.apply(resolveSkeleton(s, {}).get(name)!, 0, 0).map(Math.round);

describe('jointPositions and jointAt', () => {
  it('answers where each joint rests', () => {
    expect([...jointPositions(LEG)].map(([n, p]) => [n, Math.round(p.x), Math.round(p.y)]))
      .toEqual([['hip', 100, 100], ['knee', 100, 150], ['foot', 100, 190]]);
  });

  it('finds the nearest joint within reach, and none past it', () => {
    expect(jointAt(LEG, 103, 152, 8)).toBe('knee');
    expect(jointAt(LEG, 100, 170, 8)).toBeNull();
    // Between two joints both in reach, the nearer one.
    expect(jointAt(LEG, 100, 172, 30)).toBe('foot');
  });
});

describe('moveJoint', () => {
  it('puts the joint at the point, through its parent\'s frame, and carries its children', () => {
    const moved = moveJoint(LEG, 'knee', 130, 140);
    expect(at(moved, 'knee')).toEqual([130, 140]);
    expect(at(moved, 'foot')).toEqual([130, 180]);
    expect(at(moved, 'hip')).toEqual([100, 100]);
    expect(moved.joints[0]).toBe(LEG.joints[0]);
    expect(LEG.joints[1].bind.x).toBe(50);
  });

  it('moves a root by its own position', () => {
    const moved = moveJoint(LEG, 'hip', 0, 0);
    expect(at(moved, 'hip')).toEqual([0, 0]);
    expect(at(moved, 'knee')).toEqual([0, 50]);
  });

  it('throws on a joint the skeleton lacks', () => {
    expect(() => moveJoint(LEG, 'elbow', 0, 0)).toThrow(/no joint "elbow"/);
  });
});

describe('addJoint', () => {
  it('adds a child at a point, after its parent, under a name not in use', () => {
    const { skeleton, name } = addJoint(LEG, 'foot', 120, 190);
    expect(name).toBe('joint');
    expect(skeleton.joints.map((x) => x.name)).toEqual(['hip', 'knee', 'foot', 'joint']);
    expect(at(skeleton, 'joint')).toEqual([120, 190]);
    expect(addJoint(skeleton, 'foot', 0, 0).name).toBe('joint2');
  });

  it('adds a root where there is no parent, and takes a name', () => {
    const { skeleton, name } = addJoint({ joints: [] }, null, 10, 20, 'spine');
    expect(name).toBe('spine');
    expect(skeleton.joints).toEqual([j('spine', null, 10, 20)]);
    expect(() => addJoint(skeleton, null, 0, 0, 'spine')).toThrow(/already has a joint "spine"/);
  });
});

describe('removeJoint', () => {
  it('removes the joint and every joint under it', () => {
    const { skeleton, removed } = removeJoint(LEG, 'knee');
    expect(skeleton.joints.map((x) => x.name)).toEqual(['hip']);
    expect(removed).toEqual(['knee', 'foot']);
  });
});

describe('dropSkinJoints', () => {
  it('drops the joints\' weights and keeps the rest', () => {
    const skin = { hip: [1, 0], knee: [0, 1], foot: [0, 0] };
    expect(dropSkinJoints(skin, ['knee', 'foot'])).toEqual({ hip: [1, 0] });
    expect(dropSkinJoints(skin, ['elbow'])).toBe(skin);
  });
});
