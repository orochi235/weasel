/**
 * The lab's scene: weasel's `Scene`, parameterized on a 3D pose.
 *
 * The kernel doc claims `Scene` is dimension-neutral. This is the claim being
 * tested — nothing here subclasses, wraps or works around it.
 */

import { createScene } from '@weasel-js/core';
import type { Scene } from '@weasel-js/core';
import { compose, quatIdentity, transformPoint, type Quat, type Vec3 } from './math3d';

export type SolidKind = 'box' | 'sphere';

export interface Pose3 {
  position: Vec3;
  rotation: Quat;
  scale: Vec3;
}

export interface SolidData {
  kind: SolidKind;
  color: string;
}

export type SolidLayer = 'solids';
export type SolidScene = Scene<SolidData, SolidLayer, Pose3>;

export interface Aabb {
  min: Vec3;
  max: Vec3;
}

export function pose3(
  position: Vec3,
  scale: Vec3 = [1, 1, 1],
  rotation: Quat = quatIdentity(),
): Pose3 {
  return { position, rotation, scale };
}

/**
 * The world-space box a solid occupies. Both primitives are unit-sized about
 * their own origin, so scale 1 means one unit across.
 *
 * A non-uniformly scaled sphere is an ellipsoid; it is bounded by its largest
 * axis rather than fitted, which reads as a loose hit box rather than a wrong one.
 */
export function aabbOfSolid(pose: Pose3, kind: SolidKind): Aabb {
  if (kind === 'sphere') {
    const radius = 0.5 * Math.max(Math.abs(pose.scale[0]), Math.abs(pose.scale[1]), Math.abs(pose.scale[2]));
    return {
      min: [pose.position[0] - radius, pose.position[1] - radius, pose.position[2] - radius],
      max: [pose.position[0] + radius, pose.position[1] + radius, pose.position[2] + radius],
    };
  }

  const model = compose(pose.position, pose.rotation, pose.scale);
  let min: Vec3 = [Infinity, Infinity, Infinity];
  let max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < 8; i++) {
    const corner: Vec3 = [i & 1 ? 0.5 : -0.5, i & 2 ? 0.5 : -0.5, i & 4 ? 0.5 : -0.5];
    const p = transformPoint(model, corner);
    min = [Math.min(min[0], p[0]), Math.min(min[1], p[1]), Math.min(min[2], p[2])];
    max = [Math.max(max[0], p[0]), Math.max(max[1], p[1]), Math.max(max[2], p[2])];
  }
  return { min, max };
}

export function createSolidScene(): SolidScene {
  return createScene<SolidData, SolidLayer, Pose3>({
    systemLayers: [{ id: 'solids' }],
    initial: [
      {
        kind: 'leaf',
        layer: 'solids',
        pose: pose3([-2.2, 0.5, 0]),
        data: { kind: 'box', color: '#e06c4f' },
      },
      {
        kind: 'leaf',
        layer: 'solids',
        pose: pose3([0, 0.5, 0], [1.4, 1.4, 1.4]),
        data: { kind: 'sphere', color: '#4f9de0' },
      },
      {
        kind: 'leaf',
        layer: 'solids',
        pose: pose3([2.2, 0.75, -1], [1, 1.5, 1]),
        data: { kind: 'box', color: '#6fbf73' },
      },
    ],
  });
}
