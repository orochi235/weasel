import type { TargetAxes } from '../target';
import { IDENTITY_JOINT, type JointTransform, type Pose, type Skeleton } from './types';

const FIELDS = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const satisfies readonly (keyof JointTransform)[];
const ROTATION = FIELDS.indexOf('rotation');

/**
 * How a {@link Pose} of `skeleton` maps to the numbers an animation moves: five per joint in
 * skeleton order (`x`, `y`, `rotation`, `scaleX`, `scaleY`), every rotation an angle, so a pose
 * blends the short way round. A joint or field the pose leaves out reads as its identity, and a
 * pose read back names every joint in full. Pass it as `axes` to `createTarget` for a pose target
 * of your own; a bound rig's is `Rig.target`.
 */
export function poseAxes(skeleton: Skeleton): TargetAxes<Pose> {
  const names = skeleton.joints.map((j) => j.name);
  const n = FIELDS.length;
  return {
    count: names.length * n,
    angles: names.map((_, j) => j * n + ROTATION),
    to(pose) {
      const out = new Array<number>(names.length * n);
      for (let j = 0; j < names.length; j++) {
        const joint = pose[names[j]!];
        for (let f = 0; f < n; f++) out[j * n + f] = joint?.[FIELDS[f]!] ?? IDENTITY_JOINT[FIELDS[f]!];
      }
      return out;
    },
    from(axes) {
      const pose: Pose = {};
      for (let j = 0; j < names.length; j++) {
        const at = j * n;
        pose[names[j]!] = { x: axes[at]!, y: axes[at + 1]!, rotation: axes[at + 2]!, scaleX: axes[at + 3]!, scaleY: axes[at + 4]! };
      }
      return pose;
    },
  };
}
