import { axisIndexes } from '../axisNames';
import type { TargetAxes } from '../target';
import { IDENTITY_JOINT, type JointTransform, type Pose, type Skeleton } from './types';

const FIELDS = ['x', 'y', 'rotation', 'scaleX', 'scaleY'] as const satisfies readonly (keyof JointTransform)[];
const ROTATION = FIELDS.indexOf('rotation');

/** A name for each axis of `skeletonAxes(skeleton)`: `<joint>.<field>`. */
function axisNames(skeleton: Skeleton): string[] {
  return skeleton.joints.flatMap((joint) => FIELDS.map((field) => `${joint.name}.${field}`));
}

/**
 * The axes of `skeletonAxes(skeleton)` that belong to `joints`, as indexes, for a caller with
 * a skeleton and no target. A hold or a track on a rig's target takes the joints' names
 * themselves: `animator.hold({ target: rig.target, value: pose, axes: arm })`.
 */
export function jointAxes(skeleton: Skeleton, joints: readonly string[]): number[] {
  const names = axisNames(skeleton);
  return axisIndexes({ count: names.length, names }, joints, 'jointAxes: `joints`');
}

/**
 * How a {@link Pose} of `skeleton` maps to the numbers an animation moves: five per joint in
 * skeleton order (`x`, `y`, `rotation`, `scaleX`, `scaleY`), every rotation an angle, so a pose
 * blends the short way round. Each axis is named `<joint>.<field>`, so `axes: ['knee']` on a hold
 * reaches a joint's five and `['knee.rotation']` one of them. A joint or field the pose leaves out reads as its identity, and a
 * pose read back names every joint in full. Pass it as `axes` to `createTarget` for a pose target
 * of your own; a bound rig's is `Rig.target`.
 */
export function skeletonAxes(skeleton: Skeleton): TargetAxes<Pose> {
  const names = skeleton.joints.map((j) => j.name);
  const n = FIELDS.length;
  return {
    count: names.length * n,
    angles: names.map((_, j) => j * n + ROTATION),
    names: axisNames(skeleton),
    to(pose) {
      const out = new Array<number>(names.length * n);
      for (let j = 0; j < names.length; j++) {
        const joint = pose[names[j]!];
        for (let f = 0; f < n; f++) out[j * n + f] = joint?.[FIELDS[f]!] ?? IDENTITY_JOINT[FIELDS[f]!];
      }
      return out;
    },
    add(pose, delta) {
      const out: Pose = {};
      for (let j = 0; j < names.length; j++) {
        const joint = pose[names[j]!];
        const at = j * n;
        out[names[j]!] = {
          x: (joint?.x ?? IDENTITY_JOINT.x) + delta[at]!,
          y: (joint?.y ?? IDENTITY_JOINT.y) + delta[at + 1]!,
          rotation: (joint?.rotation ?? IDENTITY_JOINT.rotation) + delta[at + 2]!,
          scaleX: (joint?.scaleX ?? IDENTITY_JOINT.scaleX) + delta[at + 3]!,
          scaleY: (joint?.scaleY ?? IDENTITY_JOINT.scaleY) + delta[at + 4]!,
        };
      }
      return out;
    },
    write(pose, out, at) {
      for (let j = 0; j < names.length; j++) {
        const joint = pose[names[j]!];
        for (let f = 0; f < n; f++) out[at + j * n + f] = joint?.[FIELDS[f]!] ?? IDENTITY_JOINT[FIELDS[f]!];
      }
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
