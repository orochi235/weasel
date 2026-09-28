import type { JointTransform, Pose, Skeleton } from './types';

/**
 * `pose` reflected across the rig's y axis, as deltas against the same
 * skeleton — so the mirrored pose still blends, samples and resolves like any
 * other.
 *
 * Reflecting a joint chain is conjugation: every local transform `T·R·S`
 * becomes `F·T·R·S·F` with `F` the flip, which is again a plain transform
 * with `x` and `rotation` negated. Every resolved joint is then exactly the
 * original's reflection, which is how a rig faces the other way without a
 * negative scale anywhere — a scene pose such as `RectPose` has no term to
 * carry one. The negation applies to bind plus delta, so the delta for a
 * joint the pose leaves at its bind is nonzero whenever the bind is.
 *
 * Applying it twice gives the original pose back.
 */
export function mirrorPose(skeleton: Skeleton, pose: Pose): Pose {
  const out: Pose = {};
  const binds = new Map<string, JointTransform>();
  for (const joint of skeleton.joints) binds.set(joint.name, joint.bind);
  const names = new Set([...binds.keys(), ...Object.keys(pose)]);
  for (const name of names) {
    const bind = binds.get(name);
    const d = pose[name];
    out[name] = {
      ...d,
      x: -2 * (bind?.x ?? 0) - (d?.x ?? 0),
      rotation: -2 * (bind?.rotation ?? 0) - (d?.rotation ?? 0),
    };
  }
  return out;
}
