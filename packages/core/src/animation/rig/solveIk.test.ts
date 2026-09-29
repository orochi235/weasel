import { describe, expect, it } from 'vitest';
import { mat3 } from '../../renderer/math/mat3';
import { blendPoses } from './blendPoses';
import { resolveSkeleton } from './resolveSkeleton';
import { solveIk, type SolveIkOptions } from './solveIk';
import { IDENTITY_JOINT, type Pose, type Skeleton } from './types';

const j = (name: string, parent: string | null, x = 0, y = 0, rotation = 0) => ({
  name, parent, bind: { ...IDENTITY_JOINT, x, y, rotation },
});

/** shoulder at the origin, a 10-unit upper arm and a 10-unit forearm, straight along +x. */
const ARM: Skeleton = {
  joints: [j('shoulder', null), j('elbow', 'shoulder', 10, 0), j('wrist', 'elbow', 10, 0)],
};
const TIP = { x: 10, y: 0 };

/** Where the tip of `last` lands under `pose`. */
function tipOf(skel: Skeleton, pose: Pose, last: string, tip = TIP): [number, number] {
  return mat3.apply(resolveSkeleton(skel, pose).get(last)!, tip.x, tip.y);
}
const dist = (a: readonly [number, number], b: { x: number; y: number }) =>
  Math.hypot(a[0] - b.x, a[1] - b.y);

const LONG: Skeleton = {
  joints: [
    j('a', null), j('b', 'a', 10, 0), j('c', 'b', 10, 0), j('d', 'c', 10, 0),
  ],
};
const LONG_CHAIN: Pick<SolveIkOptions, 'joints' | 'tip'> = { joints: ['a', 'b', 'c', 'd'], tip: TIP };

describe('solveIk', () => {
  it('reaches a target a two-joint chain can reach', () => {
    const target = { x: 12, y: 8 };
    const out = solveIk(ARM, {}, { joints: ['shoulder', 'elbow'], tip: TIP, target });
    expect(out.reached).toBe(true);
    expect(dist(tipOf(ARM, out.pose, 'elbow'), target)).toBeLessThan(0.01);
  });

  it('converges a longer chain within the iteration cap', () => {
    const target = { x: 5, y: 25 };
    const out = solveIk(LONG, {}, { ...LONG_CHAIN, target });
    expect(out.reached).toBe(true);
    expect(out.iterations).toBeGreaterThan(0);
    expect(dist(tipOf(LONG, out.pose, 'd'), target)).toBeLessThan(0.01);
  });

  it('reports the distance it stopped at when the iteration cap runs out first', () => {
    const target = { x: 5, y: 25 };
    const out = solveIk(LONG, {}, { ...LONG_CHAIN, target, iterations: 1, tolerance: 1e-9 });
    expect(out.iterations).toBe(1);
    expect(out.reached).toBe(false);
    expect(out.distance).toBeCloseTo(dist(tipOf(LONG, out.pose, 'd'), target), 3);
  });

  it('points the chain straight at a target out of reach', () => {
    const target = { x: 0, y: 100 };
    for (const joints of [['shoulder', 'elbow'], ['a', 'b', 'c', 'd']]) {
      const skel = joints.length === 2 ? ARM : LONG;
      const out = solveIk(skel, {}, { joints, tip: TIP, target });
      expect(out.reached).toBe(false);
      const worlds = resolveSkeleton(skel, out.pose);
      for (const name of joints) {
        const [x, y] = mat3.apply(worlds.get(name)!, 0, 0);
        expect(x).toBeCloseTo(0, 3);
        expect(y).toBeGreaterThanOrEqual(-1e-3);
      }
      const [tx, ty] = tipOf(skel, out.pose, joints[joints.length - 1]);
      expect(tx).toBeCloseTo(0, 3);
      expect(ty).toBeCloseTo(joints.length * 10, 3);
      expect(out.distance).toBeCloseTo(100 - joints.length * 10, 3);
    }
  });

  it('bends a two-joint chain toward the pole', () => {
    const target = { x: 14, y: 0 };
    const up = solveIk(ARM, {}, { joints: ['shoulder', 'elbow'], tip: TIP, target, pole: { x: 7, y: 10 } });
    const down = solveIk(ARM, {}, { joints: ['shoulder', 'elbow'], tip: TIP, target, pole: { x: 7, y: -10 } });
    const elbowY = (p: Pose) => mat3.apply(resolveSkeleton(ARM, p).get('elbow')!, 0, 0)[1];
    expect(elbowY(up.pose)).toBeGreaterThan(1);
    expect(elbowY(down.pose)).toBeLessThan(-1);
    expect(dist(tipOf(ARM, up.pose, 'elbow'), target)).toBeLessThan(0.01);
    expect(dist(tipOf(ARM, down.pose, 'elbow'), target)).toBeLessThan(0.01);
  });

  it('keeps the bend the input pose already has when no pole is given', () => {
    const target = { x: 14, y: 0 };
    const bentDown: Pose = { shoulder: { rotation: -0.3 }, elbow: { rotation: 0.6 } };
    const out = solveIk(ARM, bentDown, { joints: ['shoulder', 'elbow'], tip: TIP, target });
    expect(mat3.apply(resolveSkeleton(ARM, out.pose).get('elbow')!, 0, 0)[1]).toBeLessThan(-1);
  });

  it('holds every joint inside its limits', () => {
    const limits = { shoulder: { min: -0.2, max: 0.2 }, elbow: { min: 0, max: 0.5 } };
    const out = solveIk(ARM, {}, { joints: ['shoulder', 'elbow'], tip: TIP, target: { x: 0, y: 15 }, limits });
    expect(out.reached).toBe(false);
    expect(out.pose.shoulder.rotation!).toBeGreaterThanOrEqual(-0.2 - 1e-9);
    expect(out.pose.shoulder.rotation!).toBeLessThanOrEqual(0.2 + 1e-9);
    expect(out.pose.elbow.rotation!).toBeGreaterThanOrEqual(-1e-9);
    expect(out.pose.elbow.rotation!).toBeLessThanOrEqual(0.5 + 1e-9);
  });

  it('takes the other bend when the pole side breaks a limit', () => {
    const target = { x: 14, y: 0 };
    // The elbow may only bend clockwise (+), which puts it below the line.
    const out = solveIk(ARM, {}, {
      joints: ['shoulder', 'elbow'], tip: TIP, target,
      pole: { x: 7, y: -10 }, limits: { elbow: { min: -Math.PI, max: 0 } },
    });
    expect(out.reached).toBe(true);
    expect(out.pose.elbow.rotation!).toBeLessThanOrEqual(1e-9);
    expect(dist(tipOf(ARM, out.pose, 'elbow'), target)).toBeLessThan(0.01);
  });

  it('holds limits on a longer chain', () => {
    const limits = { a: { min: 0, max: 0.3 }, b: { min: 0, max: 0.3 }, c: { min: 0, max: 0.3 }, d: { min: 0, max: 0.3 } };
    const out = solveIk(LONG, {}, { ...LONG_CHAIN, target: { x: -20, y: 5 }, limits });
    for (const name of ['a', 'b', 'c', 'd']) {
      expect(out.pose[name].rotation!).toBeGreaterThanOrEqual(-1e-9);
      expect(out.pose[name].rotation!).toBeLessThanOrEqual(0.3 + 1e-9);
    }
  });

  it('solves against a rotated bind, a translated pose and a mirrored parent', () => {
    const skel: Skeleton = {
      joints: [
        { name: 'root', parent: null, bind: { ...IDENTITY_JOINT, x: 50, y: 20, scaleX: -1 } },
        j('shoulder', 'root', 3, 4, 0.7),
        j('elbow', 'shoulder', 10, 0, -0.4),
      ],
    };
    const pose: Pose = { root: { x: 5 }, shoulder: { rotation: 0.2 } };
    const target = { x: 40, y: 32 };
    const out = solveIk(skel, pose, { joints: ['shoulder', 'elbow'], tip: TIP, target });
    expect(out.reached).toBe(true);
    expect(dist(tipOf(skel, out.pose, 'elbow'), target)).toBeLessThan(0.01);
  });

  it('leaves joints outside the chain, and non-rotation fields, as the input had them', () => {
    const skel: Skeleton = { joints: [...ARM.joints, j('hand', 'wrist', 3, 0)] };
    const pose: Pose = { hand: { rotation: 0.4 }, elbow: { x: 1, rotation: 0.1 } };
    const out = solveIk(skel, pose, { joints: ['shoulder', 'elbow'], tip: TIP, target: { x: 5, y: 12 } });
    expect(out.pose.hand).toEqual({ rotation: 0.4 });
    expect(out.pose.elbow.x).toBe(1);
    expect(pose.elbow).toEqual({ x: 1, rotation: 0.1 });
  });

  it('returns a pose that blends with the one it started from', () => {
    const start: Pose = { shoulder: { rotation: 0.3 }, elbow: { rotation: 0.2 } };
    const target = { x: 4, y: 15 };
    const solved = solveIk(ARM, start, { joints: ['shoulder', 'elbow'], tip: TIP, target }).pose;

    expect(dist(tipOf(ARM, blendPoses([start, solved], [0, 1]), 'elbow'), target)).toBeLessThan(0.01);
    const startTip = tipOf(ARM, start, 'elbow');
    const half = tipOf(ARM, blendPoses([start, solved], [0.5, 0.5]), 'elbow');
    expect(dist(half, target)).toBeLessThan(dist(startTip, target));
    expect(blendPoses([start, solved], [0.5, 0.5]).elbow.rotation).toBeCloseTo(
      (start.elbow.rotation! + solved.elbow.rotation!) / 2, 9,
    );
  });

  it('throws when a chain joint is not the parent of the next', () => {
    expect(() => solveIk(ARM, {}, { joints: ['shoulder', 'wrist'], tip: TIP, target: { x: 0, y: 0 } }))
      .toThrow(/parent/);
    expect(() => solveIk(ARM, {}, { joints: ['shoulder', 'nope'], tip: TIP, target: { x: 0, y: 0 } }))
      .toThrow(/nope/);
  });
});
