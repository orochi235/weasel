import { mat3, type GlMat3 } from '../../renderer/math/mat3';
import { compose, resolveSkeleton, toMat3 } from './resolveSkeleton';
import type { Joint, Pose, Skeleton } from './types';

const TAU = Math.PI * 2;

/** A point in the skeleton's space — the space `resolveSkeleton` resolves into. */
export interface IkPoint {
  x: number;
  y: number;
}

/** Bounds on a joint's rotation delta from its bind, in radians, with
 *  `-PI <= min <= max <= PI`. */
export interface IkLimit {
  min: number;
  max: number;
}

/** Options for {@link solveIk}. */
export interface SolveIkOptions {
  /** The joints the solver may rotate, root first, each the parent of the next. */
  joints: readonly string[];
  /** The end effector, in the last joint's local frame — the forearm's length
   *  along its +x for an arm, or a hand joint's bind offset. */
  tip: IkPoint;
  /** Where the tip should go, in skeleton space. A rig posed with a `root`
   *  wants the target carried back through that root's inverse first. */
  target: IkPoint;
  /** Per-joint limits, keyed by joint name. A joint without one turns freely. */
  limits?: Readonly<Record<string, IkLimit>>;
  /** Two-joint chains only: the middle joint bends toward this point, in
   *  skeleton space. Without it the chain keeps the bend the input pose has. */
  pole?: IkPoint;
  /** Most CCD sweeps to run. Default 32. */
  iterations?: number;
  /** Tip-to-target distance that counts as reached, in skeleton units.
   *  Default 0.01. */
  tolerance?: number;
}

/** What {@link solveIk} returns. */
export interface IkResult {
  /** The input pose with each chain joint's rotation replaced. */
  pose: Pose;
  /** Tip-to-target distance the solve ended at. */
  distance: number;
  /** Whether `distance` is within the tolerance. False for a target out of
   *  reach, which leaves the chain pointing straight at it. */
  reached: boolean;
  /** CCD sweeps run; 0 when the two-joint solution or the straight-line
   *  answer for an unreachable target settled it. */
  iterations: number;
}

function wrap(a: number): number {
  return a - TAU * Math.round(a / TAU);
}

/** `v` held to `limit`, where out of range means the nearer bound around the circle. */
function clampAngle(v: number, limit: IkLimit | undefined): number {
  if (!limit) return v;
  for (const c of [v, v - TAU, v + TAU]) if (c >= limit.min && c <= limit.max) return c;
  return Math.abs(wrap(v - limit.min)) <= Math.abs(wrap(v - limit.max)) ? limit.min : limit.max;
}

const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;

/**
 * Rotate a joint chain so its tip reaches `target`, returning the result as an
 * ordinary {@link Pose} — so it blends with `blendPoses` (weighting the IK
 * against an animated pose is `blendPoses([anim, solved], [1 - w, w])`),
 * samples on a `SampledTrack<Pose>` and drives a rig through `Rig.pose`.
 *
 * The solver is cyclic coordinate descent: each step turns one joint so the
 * tip lies on the ray from that joint to the target. A joint's rotation is the
 * one term the rig lets it change, and a CCD step is exactly a change to it, so
 * limits clamp the value the pose stores and nothing has to be converted back
 * from positions. Each step is solved in the joint's parent frame, which makes
 * it exact under any parent transform the skeleton composes, mirrors included.
 *
 * A two-joint chain is solved analytically first: of the two bends that reach
 * the target it takes the one on `pole`'s side, or the input pose's side, and
 * falls back to the other bend and then to CCD when limits refuse it. A target
 * beyond the chain's reach straightens the chain toward it.
 */
export function solveIk(skeleton: Skeleton, pose: Pose, options: SolveIkOptions): IkResult {
  const { tip, target, limits } = options;
  const maxIterations = options.iterations ?? 32;
  const tolerance = options.tolerance ?? 0.01;

  const byName = new Map<string, Joint>();
  for (const joint of skeleton.joints) byName.set(joint.name, joint);
  const chain = options.joints.map((name, i) => {
    const joint = byName.get(name);
    if (!joint) throw new Error(`solveIk: the skeleton has no joint "${name}".`);
    if (i > 0 && joint.parent !== options.joints[i - 1]) {
      throw new Error(
        `solveIk: chain joint "${name}" names parent "${joint.parent}", not "${options.joints[i - 1]}". ` +
        'Each chain joint must be the parent of the next.',
      );
    }
    return joint;
  });
  const n = chain.length;
  if (n === 0) return { pose: { ...pose }, distance: Infinity, reached: false, iterations: 0 };

  const rootParent = chain[0].parent;
  const base = rootParent == null ? mat3.identity() : resolveSkeleton(skeleton, pose).get(rootParent)!;
  const rot = chain.map((joint) => clampAngle(wrap(pose[joint.name]?.rotation ?? 0), limits?.[joint.name]));

  let worlds: GlMat3[] = [];
  const resolve = () => {
    worlds = [];
    let parent = base;
    for (let i = 0; i < n; i += 1) {
      const joint = chain[i];
      parent = mat3.multiply(parent, toMat3(compose(joint.bind, { ...pose[joint.name], rotation: rot[i] })));
      worlds.push(parent);
    }
  };
  const pivot = (i: number) => mat3.apply(worlds[i], 0, 0);
  const tipWorld = () => mat3.apply(worlds[n - 1], tip.x, tip.y);
  /** The point joint `i` swings: the next joint's pivot, or the tip. */
  const next = (i: number) => (i + 1 < n ? pivot(i + 1) : tipWorld());

  /** Turn joint `i` so `effector` lies on the ray toward `goal`. True when a
   *  limit cut the turn short. */
  const aim = (i: number, effector: [number, number], goal: IkPoint): boolean => {
    const inv = mat3.invert(i === 0 ? base : worlds[i - 1]);
    if (!inv) return false;
    const [ox, oy] = mat3.apply(inv, ...pivot(i));
    const [ex, ey] = mat3.apply(inv, ...effector);
    const [gx, gy] = mat3.apply(inv, goal.x, goal.y);
    if (Math.hypot(ex - ox, ey - oy) < 1e-9 || Math.hypot(gx - ox, gy - oy) < 1e-9) return false;
    const want = wrap(rot[i] + Math.atan2(gy - oy, gx - ox) - Math.atan2(ey - oy, ex - ox));
    rot[i] = clampAngle(want, limits?.[chain[i].name]);
    resolve();
    return Math.abs(wrap(rot[i] - want)) > 1e-9;
  };

  const distance = () => {
    const [x, y] = tipWorld();
    return Math.hypot(x - target.x, y - target.y);
  };
  const result = (iterations: number): IkResult => {
    const out: Pose = { ...pose };
    chain.forEach((joint, i) => { out[joint.name] = { ...pose[joint.name], rotation: rot[i] }; });
    const d = distance();
    return { pose: out, distance: d, reached: d <= tolerance, iterations };
  };

  resolve();
  const [rx, ry] = pivot(0);
  let reach = 0;
  for (let i = 0; i < n; i += 1) {
    const [ax, ay] = pivot(i);
    const [bx, by] = next(i);
    reach += Math.hypot(bx - ax, by - ay);
  }
  const toTarget = Math.hypot(target.x - rx, target.y - ry);

  if (toTarget >= reach) {
    for (let i = 0; i < n; i += 1) aim(i, next(i), target);
    return result(0);
  }

  if (n === 2 && toTarget > 1e-9) {
    const start = rot.slice();
    const [mx, my] = pivot(1);
    const [tx, ty] = tipWorld();
    const a = Math.hypot(mx - rx, my - ry);
    const b = Math.hypot(tx - mx, ty - my);
    const dx = target.x - rx;
    const dy = target.y - ry;
    const bendSide = options.pole
      ? cross(dx, dy, options.pole.x - rx, options.pole.y - ry)
      : cross(dx, dy, mx - rx, my - ry);
    const side = bendSide < 0 ? -1 : 1;
    const inner = Math.acos(Math.max(-1, Math.min(1, (a * a + toTarget * toTarget - b * b) / (2 * a * toTarget))));
    const heading = Math.atan2(dy, dx);

    const bend = (s: number): boolean => {
      rot.splice(0, 2, ...start);
      resolve();
      const elbow = { x: rx + a * Math.cos(heading + s * inner), y: ry + a * Math.sin(heading + s * inner) };
      const cut = aim(0, pivot(1), elbow);
      return aim(1, tipWorld(), target) || cut;
    };
    if (!bend(side) || !bend(-side)) {
      if (distance() <= tolerance) return result(0);
    } else {
      bend(side);
    }
  }

  let iterations = 0;
  while (iterations < maxIterations && distance() > tolerance) {
    for (let i = n - 1; i >= 0; i -= 1) aim(i, tipWorld(), target);
    iterations += 1;
  }
  return result(iterations);
}
