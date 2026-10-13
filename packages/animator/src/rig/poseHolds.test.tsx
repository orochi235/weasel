import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createTarget } from '../target';
import { useAnimator } from '../useAnimator';
import { skeletonAxes } from './skeletonAxes';
import { IDENTITY_JOINT, type Pose, type Skeleton } from './types';

const skeleton: Skeleton = {
  joints: [
    { name: 'hip', parent: null, bind: { ...IDENTITY_JOINT } },
    { name: 'knee', parent: 'hip', bind: { ...IDENTITY_JOINT, x: 10 } },
  ],
};
const TAU = Math.PI * 2;

/** What a pose target shows with `poses` held on it at `weights`, over `committed`. */
function held(poses: Pose[], weights: number[], committed: Pose = {}): Pose {
  let pose = committed;
  const target = createTarget<Pose>({ get: () => pose, set: (p) => { pose = p; }, axes: skeletonAxes(skeleton) });
  const { result } = renderHook(() => useAnimator({ now: () => 0, requestFrame: () => 0, cancelFrame: () => {} }));
  act(() => { poses.forEach((value, i) => result.current.hold({ target, value, weight: weights[i] })); });
  return target.read();
}

// The cases the rig's own weighted pose blend was tested by, before holds on a pose target
// replaced it.
describe('poses held on a target', () => {
  it('shows the committed pose with nothing held', () => {
    expect(held([], [])).toEqual({});
  });

  it('fills a single pose out to a full delta at weight 1, on every joint of the skeleton', () => {
    expect(held([{ hip: { x: 10, rotation: 0.5 } }], [1])).toEqual({
      hip: { x: 10, y: 0, rotation: 0.5, scaleX: 1, scaleY: 1 },
      knee: { ...IDENTITY_JOINT },
    });
  });

  it('averages two poses at equal weights', () => {
    expect(held([{ hip: { x: 0 } }, { hip: { x: 10 } }], [0.5, 0.5]).hip!.x).toBeCloseTo(5, 9);
  });

  it('shares full strength among weights that sum past 1', () => {
    expect(held([{ hip: { x: 0 } }, { hip: { x: 10 } }], [1, 1]).hip!.x).toBeCloseTo(5, 9);
  });

  it('leaves what the weights fall short of 1 to the bind pose, not normalizing them', () => {
    const out = held([{ hip: { x: 0, scaleX: 3 } }, { hip: { x: 10, scaleX: 3 } }], [0.3, 0.3]);
    expect(out.hip!.x).toBeCloseTo(3, 9);
    // Toward the bind pose's 1, not toward 0.
    expect(out.hip!.scaleX).toBeCloseTo(2.2, 9);
  });

  it('unions joints across poses, treating an absent joint as bind', () => {
    const out = held([{ hip: { x: 10 } }, { knee: { x: 20 } }], [0.5, 0.5]);
    expect(out.hip!.x).toBeCloseTo(5, 9);
    expect(out.knee!.x).toBeCloseTo(10, 9);
  });

  it('treats an absent field as its identity, not as zero for scale', () => {
    const out = held([{ hip: { scaleX: 3 } }, { hip: { x: 4 } }], [0.5, 0.5]);
    expect(out.hip!.scaleX).toBeCloseTo(2, 9);
    expect(out.hip!.x).toBeCloseTo(2, 9);
  });

  it('blends rotation the short way around the circle', () => {
    const out = held([{ hip: { rotation: 0.1 } }, { hip: { rotation: TAU - 0.1 } }], [0.5, 0.5]);
    expect(out.hip!.rotation).toBeCloseTo(0, 6);
  });

  it('shows the bind pose, spelled out, when the weights sum to zero', () => {
    expect(held([{ hip: { x: 10 } }], [0])).toEqual({ hip: { ...IDENTITY_JOINT }, knee: { ...IDENTITY_JOINT } });
  });

  it('wraps a rotation delta of more than a full turn', () => {
    const out = held([{ hip: { rotation: 0 } }, { hip: { rotation: Math.PI * 6 + 0.2 } }], [0.5, 0.5]);
    expect(out.hip!.rotation).toBeCloseTo(0.1, 6);
  });

  it('lands on the committed pose\'s turn, not the first pose\'s', () => {
    const out = held([{ hip: { rotation: TAU - 0.1 } }, { hip: { rotation: 0.1 } }], [0.5, 0.5]);
    // The same angle as TAU, the first pose's turn, which the old blend answered.
    expect(out.hip!.rotation).toBeCloseTo(0, 6);
  });

  it('rotates a joint absent from the first pose toward the pose that has it', () => {
    expect(held([{ hip: { x: 1 } }, { knee: { rotation: 1 } }], [0.5, 0.5]).knee!.rotation).toBeCloseTo(0.5, 9);
  });

  it('folds three poses to their weighted average', () => {
    const out = held(
      [{ hip: { x: 10, rotation: 0.2 } }, { hip: { x: 20, rotation: TAU - 0.4 } }, { hip: { x: 40, rotation: 1 } }],
      [0.2, 0.3, 0.5],
    );
    expect(out.hip!.x).toBeCloseTo(0.2 * 10 + 0.3 * 20 + 0.5 * 40, 9);
    expect(out.hip!.rotation).toBeCloseTo(0.2 * 0.2 + 0.3 * -0.4 + 0.5 * 1, 9);
  });

  it('turns two held rotations the short way toward each other, wherever the committed pose is', () => {
    // 3 and -3 are 0.28 apart through PI, and 6 apart through the bind pose's 0.
    const poses: Pose[] = [{ hip: { rotation: 3 } }, { hip: { rotation: -3 } }];
    expect(Math.cos(held(poses, [0.5, 0.5]).hip!.rotation!)).toBeCloseTo(-1, 6);
    expect(Math.cos(held(poses, [0.5, 0.5], { hip: { rotation: Math.PI } }).hip!.rotation!)).toBeCloseTo(-1, 6);
    expect(Math.cos(held(poses, [0.5, 0.5], { hip: { rotation: 1 } }).hip!.rotation!)).toBeCloseTo(-1, 6);
  });

  it('does not let a hold at almost no weight decide which way the others turn', () => {
    const poses: Pose[] = [{ hip: { rotation: 0 } }, { hip: { rotation: 3 } }, { hip: { rotation: -3 } }];
    expect(Math.cos(held(poses, [0.001, 0.4995, 0.4995]).hip!.rotation!)).toBeCloseTo(-1, 4);
  });

  it('turns the short way from the committed pose toward where the holds meet, at weights short of 1', () => {
    const poses: Pose[] = [{ hip: { rotation: 3 } }, { hip: { rotation: -3 } }];
    // They meet at PI, which is PI - 3 past a committed 3; half of that shows.
    expect(held(poses, [0.25, 0.25], { hip: { rotation: 3 } }).hip!.rotation).toBeCloseTo(3 + (Math.PI - 3) / 2, 6);
  });
});
