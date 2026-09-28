// apps/site/demos/platformer/boneRig.ts
import { mirrorPose, type Pose, type RectPose } from '@weasel-js/core';
import { BONE_LENGTH, BONE_WIDTH, PLAYER_SKELETON, ROOT_TO_FOOT } from './skeleton';
import type { Vec2 } from './level';

/**
 * The rig as scene-tree parenting: one local `RectPose` per bone, composed to
 * world by `RIGID_POSE_COMPOSITION` rather than by resolving every joint to a
 * matrix here.
 *
 * A bone's box is its joint's frame slid half a bone along local +x, so a
 * child bone's local pose under its parent bone's frame is fixed by the
 * child joint's own offset and rotation — the parent's angle never appears,
 * because composition supplies it.
 *
 * Facing left is `mirrorPose`: `RectPose` has no scale term to carry a
 * reflection, so the mirror goes into the joint data. A mirrored joint frame
 * is reflected too, which is why each bone then extends along its local -x.
 */

/** A joint's local transform for one frame: bind plus this frame's delta. */
function localOf(name: string, pose: Pose): { x: number; y: number; rotation: number } {
  const joint = PLAYER_SKELETON.joints.find((j) => j.name === name);
  if (!joint) throw new Error(`boneRig: no joint named "${name}"`);
  const d = pose[name];
  return {
    x: joint.bind.x + (d?.x ?? 0),
    y: joint.bind.y + (d?.y ?? 0),
    rotation: joint.bind.rotation + (d?.rotation ?? 0),
  };
}

/**
 * Local poses for every bone, keyed by joint name. `hip` is the rig root and
 * its pose is world; the other ten are local to their parent bone.
 *
 * `at` is the player's center and `facing` its 1 | -1 mirror, the same pair
 * the world-matrix placement took.
 */
export function boneLocalPoses(pose: Pose, at: Vec2, facing: 1 | -1): Map<string, RectPose> {
  const out = new Map<string, RectPose>();
  const faced = facing === 1 ? pose : mirrorPose(PLAYER_SKELETON, pose);

  for (const joint of PLAYER_SKELETON.joints) {
    const name = joint.name;
    const len = BONE_LENGTH[name];
    const wid = BONE_WIDTH[name];
    const local = localOf(name, faced);
    // Where the bone's far end lies along its joint's local x axis.
    const along = facing * len;

    if (joint.parent == null) {
      // The root bone's frame origin, then half a bone along it.
      const ox = at.x + local.x;
      const oy = at.y - ROOT_TO_FOOT + local.y;
      out.set(name, {
        x: ox + (along / 2) * Math.cos(local.rotation) - len / 2,
        y: oy + (along / 2) * Math.sin(local.rotation) - wid / 2,
        width: len,
        height: wid,
        rotation: local.rotation,
      });
      continue;
    }

    const parentLen = BONE_LENGTH[joint.parent];
    const parentWid = BONE_WIDTH[joint.parent];
    // Offset of this bone's box center from the parent bone's, in the parent's
    // unrotated frame — which is what `composeRigidPose` reads.
    const ux = local.x - (facing * parentLen) / 2 + (along / 2) * Math.cos(local.rotation);
    const uy = local.y + (along / 2) * Math.sin(local.rotation);
    out.set(name, {
      x: ux - len / 2 + parentLen / 2,
      y: uy - wid / 2 + parentWid / 2,
      width: len,
      height: wid,
      rotation: local.rotation,
    });
  }

  return out;
}
