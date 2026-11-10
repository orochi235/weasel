/**
 * The rig: a mirrored pose resolves to the mirror image, skeleton edits put a joint where asked and
 * carry its subtree along, weight edits keep each point's sum, and IK reports the distance it
 * left and keeps to its limits.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mat3 } from '@weasel-js/geom';
import { mirrorPose } from './mirrorPose';
import { compose, resolveSkeleton } from './resolveSkeleton';
import { addJoint, jointAt, jointPositions, moveJoint, removeJoint } from './skeletonEdits';
import { solveIk, type IkLimit } from './solveIk';
import { jointShares, setWeights } from './weightEdits';
import type { JointTransform, Pose, Skeleton } from './types';
import { runs, tally } from '../pbt.fixture';

const RUNS = runs(300);

const coord = fc.integer({ min: -200, max: 200 }).map((n) => n / 2);
const angle = fc.double({ min: -Math.PI, max: Math.PI, noNaN: true });
const scale = fc.constantFrom(1, 0.5, 2, -1, 1.25);
const transform: fc.Arbitrary<JointTransform> = fc.record({ x: coord, y: coord, rotation: angle, scaleX: scale, scaleY: scale });

/** A skeleton of up to six joints, each after its parent. */
const skeleton: fc.Arbitrary<Skeleton> = fc.array(fc.tuple(fc.nat(), fc.boolean(), transform), { minLength: 1, maxLength: 6 })
  .map((js) => ({
    joints: js.map(([p, root, bind], i) => ({ name: `j${i}`, parent: i === 0 || root ? null : `j${p % i}`, bind })),
  }));
const delta = fc.record({ x: coord, y: coord, rotation: angle, scaleX: scale, scaleY: scale }, { requiredKeys: [] });
const poseOf = (s: Skeleton): fc.Arbitrary<Pose> =>
  fc.array(fc.option(delta, { nil: undefined }), { minLength: s.joints.length, maxLength: s.joints.length })
    .map((ds) => Object.fromEntries(ds.flatMap((d, i) => (d ? [[`j${i}`, d]] : []))));

const origin = (m: Float32Array): [number, number] => mat3.apply(m as never, 0, 0);
/** Close to a float32 resolve of a chain of up to six joints of these sizes. */
const near = (a: number, b: number): void => { expect(Math.abs(a - b)).toBeLessThanOrEqual(2e-3 * Math.max(1, Math.abs(a), Math.abs(b))); };

describe('mirrorPose, property', () => {
  it('resolves to the mirror image across the y axis, and back again applied twice', () => {
    fc.assert(fc.property(skeleton.chain((s) => fc.tuple(fc.constant(s), poseOf(s))), ([s, pose]) => {
      const flipped = resolveSkeleton(s, mirrorPose(s, pose));
      const world = resolveSkeleton(s, pose);
      for (const [name, m] of world) {
        const f = flipped.get(name)!;
        const [x, y] = origin(m), [fx, fy] = origin(f);
        near(fx, -x);
        near(fy, y);
        // The mirror of a point is the point mirrored, carried by the joint, and mirrored back.
        for (const [px, py] of [[1, 0], [0, 1], [3, -2]] as const) {
          const [mx, my] = mat3.apply(m as never, -px, py), [gx, gy] = mat3.apply(f as never, px, py);
          near(gx, -mx);
          near(gy, my);
        }
      }
      const twice = mirrorPose(s, mirrorPose(s, pose));
      for (const j of s.joints) {
        const a = compose(j.bind, twice[j.name]), b = compose(j.bind, pose[j.name]);
        for (const k of ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const) near(a[k], b[k]);
      }
    }), RUNS);
  });
});

/** A skeleton whose every joint can be inverted at rest. */
const invertible = skeleton.map((s) => ({ joints: s.joints.map((j) => ({ ...j, bind: { ...j.bind, scaleX: Math.abs(j.bind.scaleX) || 1, scaleY: Math.abs(j.bind.scaleY) || 1 } })) }));

describe('skeleton edits, property', () => {
  it('addJoint and moveJoint put the joint where asked, and moveJoint carries its subtree with it', () => {
    const t = tally();
    fc.assert(fc.property(invertible, fc.nat(), coord, coord, fc.boolean(), (s, pick, x, y, root) => {
      const parent = root ? null : s.joints[pick % s.joints.length]!.name;
      const added = addJoint(s, parent, x, y);
      const at = jointPositions(added.skeleton).get(added.name)!;
      near(at.x, x);
      near(at.y, y);
      expect(jointAt(added.skeleton, x, y, 0.01)).not.toBeNull();

      const name = s.joints[pick % s.joints.length]!.name;
      const before = jointPositions(s);
      const after = jointPositions(moveJoint(s, name, x, y));
      const was = before.get(name)!;
      const under = new Set([name]);
      for (const j of s.joints) if (j.parent && under.has(j.parent)) under.add(j.name);
      for (const [n, p] of before) {
        const q = after.get(n)!;
        const dx = under.has(n) ? x - was.x : 0, dy = under.has(n) ? y - was.y : 0;
        near(q.x, p.x + dx);
        near(q.y, p.y + dy);
      }
      if (under.size > 1) t.count('subtree');
    }), RUNS);
    t.atLeast('subtree', 30);
  });

  it('removeJoint takes the joint and everything under it, and leaves no joint without its parent', () => {
    fc.assert(fc.property(skeleton, fc.nat(), (s, pick) => {
      const name = s.joints[pick % s.joints.length]!.name;
      const { skeleton: rest, removed } = removeJoint(s, name);
      const names = new Set(rest.joints.map((j) => j.name));
      expect(removed).toContain(name);
      expect(rest.joints.length + removed.length).toBe(s.joints.length);
      for (const j of rest.joints) if (j.parent) expect(names.has(j.parent)).toBe(true);
      for (const r of removed) {
        const j = s.joints.find((o) => o.name === r)!;
        expect(r === name || removed.includes(j.parent!)).toBe(true);
      }
      expect(() => resolveSkeleton(rest, {})).not.toThrow();
    }), RUNS);
  });
});

describe('setWeights, property', () => {
  const weights = (count: number) => fc.array(fc.constantFrom(0, 0.25, 0.5, 1, 2), { maxLength: count + 2 });
  it('gives the joint its weight on each point named and leaves each such point summing to 1', () => {
    const t = tally();
    fc.assert(fc.property(fc.integer({ min: 1, max: 6 }).chain((count) => fc.tuple(
      fc.constant(count),
      fc.dictionary(fc.constantFrom('a', 'b', 'c'), weights(count)),
      fc.constantFrom('a', 'b', 'd'),
      fc.array(fc.tuple(fc.integer({ min: -1, max: count }), fc.oneof(fc.double({ min: -0.5, max: 1.5, noNaN: true }), fc.constantFrom(0, 1)))),
    )), ([count, skin, joint, edits]) => {
      const set = new Map(edits);
      const next = setWeights(skin, count, joint, set);
      for (const w of Object.values(next)) {
        expect(w).toHaveLength(count);
        expect(w.some((x) => x > 0)).toBe(true);
      }
      const shares = jointShares(next, joint, count);
      for (const [i, raw] of set) {
        if (i < 0 || i >= count) continue;
        const want = Math.min(1, Math.max(0, raw));
        const sum = Object.values(next).reduce((s, w) => s + w[i]!, 0);
        if (sum === 0) { expect(want).toBe(0); continue; }
        near(sum, 1);
        near(shares[i]!, Object.keys(skin).some((k) => k !== joint && (skin[k]![i] ?? 0) > 0) ? want : want > 0 ? 1 : 0);
        t.count('point');
      }
      for (let i = 0; i < count; i++) {
        if (set.has(i)) continue;
        for (const [name, w] of Object.entries(next)) expect(w[i]).toBe(skin[name]?.[i] ?? 0);
      }
    }), RUNS);
    t.atLeast('point', 100);
  });
});

describe('solveIk, property', () => {
  const limit: fc.Arbitrary<IkLimit | undefined> = fc.option(fc.tuple(angle, angle).map(([a, b]) => ({ min: Math.min(a, b), max: Math.max(a, b) })), { nil: undefined });
  const chain = fc.tuple(fc.integer({ min: 1, max: 4 }), fc.array(fc.integer({ min: 5, max: 60 }), { minLength: 4, maxLength: 4 }), fc.array(limit, { minLength: 4, maxLength: 4 }))
    .map(([n, lengths, limits]) => {
      const joints = Array.from({ length: n }, (_, i) => ({
        name: `j${i}`, parent: i === 0 ? null : `j${i - 1}`,
        bind: { x: i === 0 ? 0 : lengths[i - 1]!, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      }));
      return { skeleton: { joints }, n, tip: { x: lengths[n - 1]!, y: 0 }, limits: Object.fromEntries(limits.slice(0, n).flatMap((l, i) => (l ? [[`j${i}`, l]] : []))) };
    });

  it('reports the distance its pose leaves, and keeps each joint within its limit', () => {
    const t = tally();
    fc.assert(fc.property(chain, coord, coord, fc.boolean(), ({ skeleton: s, n, tip, limits }, x, y, limited) => {
      const joints = s.joints.map((j) => j.name);
      const r = solveIk(s, {}, { joints, tip, target: { x, y }, ...(limited ? { limits } : {}) });
      const [tx, ty] = mat3.apply(resolveSkeleton(s, r.pose).get(`j${n - 1}`)! as never, tip.x, tip.y);
      near(r.distance, Math.hypot(tx - x, ty - y));
      expect(r.reached).toBe(r.distance <= 0.01);
      if (limited) {
        for (const [name, l] of Object.entries(limits)) {
          const rot = r.pose[name]!.rotation!;
          expect(rot).toBeGreaterThanOrEqual(l.min - 1e-9);
          expect(rot).toBeLessThanOrEqual(l.max + 1e-9);
          t.count('limited');
        }
      }
      if (r.reached) t.count('reached');
    }), RUNS);
    t.atLeast('limited', 50);
    t.atLeast('reached', 30);
  });

  it('reaches a target inside a free two-joint chain\'s annulus', () => {
    fc.assert(fc.property(fc.integer({ min: 5, max: 60 }), fc.integer({ min: 5, max: 60 }), fc.double({ min: 0.05, max: 0.95, noNaN: true }), angle,
      (a, b, along, heading) => {
        const s: Skeleton = { joints: [
          { name: 'j0', parent: null, bind: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
          { name: 'j1', parent: 'j0', bind: { x: a, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } },
        ] };
        const lo = Math.abs(a - b), hi = a + b;
        const d = lo + (hi - lo) * along;
        const r = solveIk(s, {}, { joints: ['j0', 'j1'], tip: { x: b, y: 0 }, target: { x: d * Math.cos(heading), y: d * Math.sin(heading) } });
        expect(r.reached).toBe(true);
      }), RUNS);
  });
});
