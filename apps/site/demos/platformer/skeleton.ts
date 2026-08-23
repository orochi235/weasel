// apps/site/demos/platformer/skeleton.ts
import type { Joint, Skeleton } from '@weasel-js/core';

/**
 * Bones point along their own local +x. A joint's `bind.x` is therefore the
 * parent bone's length, which is what puts each joint at the far end of its
 * parent. y is screen-down, so -PI/2 points a bone up the screen.
 */
const j = (name: string, parent: string | null, x: number, y: number, rotation: number): Joint => ({
  name,
  parent,
  bind: { x, y, rotation, scaleX: 1, scaleY: 1 },
});

export const PLAYER_SKELETON: Skeleton = {
  joints: [
    j('hip', null, 0, 0, 0),
    j('torso', 'hip', 0, -2, -Math.PI / 2),
    j('head', 'torso', 13, 0, 0),
    j('armL', 'torso', 9, 0, 2.5),
    j('foreL', 'armL', 8, 0, 0.4),
    j('armR', 'torso', 9, 0, -2.5),
    j('foreR', 'armR', 8, 0, -0.4),
    j('thighL', 'hip', 0, 2, Math.PI / 2),
    j('shinL', 'thighL', 9, 0, 0),
    j('thighR', 'hip', 0, 2, Math.PI / 2),
    j('shinR', 'thighR', 9, 0, 0),
  ],
};

export const JOINT_ORDER = PLAYER_SKELETON.joints.map((joint) => joint.name);

/** Drawn length of the bone starting at each joint, in world units. */
export const BONE_LENGTH: Record<string, number> = {
  hip: 6,
  torso: 13,
  head: 8,
  armL: 8,
  foreL: 7,
  armR: 8,
  foreR: 7,
  thighL: 9,
  shinL: 9,
  thighR: 9,
  shinR: 9,
};

/** Drawn thickness of the bone starting at each joint, in world units. */
export const BONE_WIDTH: Record<string, number> = {
  hip: 9,
  torso: 9,
  head: 8,
  armL: 4,
  foreL: 3.5,
  armR: 4,
  foreR: 3.5,
  thighL: 5,
  shinL: 4,
  thighR: 5,
  shinR: 4,
};

const thighL = PLAYER_SKELETON.joints.find((joint) => joint.name === 'thighL')!;

/** Rig root is `hip`, not the feet: the feet hang this far below it (thigh bind y + thigh + shin length). */
export const ROOT_TO_FOOT = thighL.bind.y + BONE_LENGTH.thighL + BONE_LENGTH.shinL;
