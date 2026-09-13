/**
 * The lab's scene: weasel's `Scene`, parameterized on a 3D pose.
 *
 * The kernel doc claims `Scene` is dimension-neutral. This is the claim being
 * tested — nothing here subclasses, wraps or works around it.
 */

import { createScene } from '@weasel-js/core';
import type { Scene, SceneNode } from '@weasel-js/core';
import { aabbAround, type Aabb } from '@weasel-js/geom/3d';
import { aabbOfPose, pose3, type Pose3 } from '@weasel-js/kernel3d';

export type SolidKind = 'box' | 'sphere';
export type { Pose3 };
export { pose3 };

export interface SolidData {
  kind: SolidKind;
  color: string;
}

export type SolidLayer = 'solids';
export type SolidScene = Scene<SolidData, SolidLayer, Pose3>;
export type SolidNode = SceneNode<SolidData, SolidLayer, Pose3>;

/**
 * The world-space box a solid occupies. Both primitives are unit-sized about
 * their own origin, so scale 1 means one unit across.
 *
 * A non-uniformly scaled sphere is an ellipsoid; it is bounded by its largest
 * axis rather than fitted, which reads as a loose hit box rather than a wrong
 * one. That it does not widen when the sphere turns is why the kernel asks for
 * a world box rather than transforming a local one: symmetry belongs to the
 * primitive, and a pose cannot report it.
 */
export function aabbOfSolid(pose: Pose3, kind: SolidKind): Aabb {
  if (kind === 'sphere') {
    const radius = 0.5 * Math.max(
      Math.abs(pose.scale[0]), Math.abs(pose.scale[1]), Math.abs(pose.scale[2]),
    );
    return aabbAround(pose.position, radius);
  }
  return aabbOfPose(pose);
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
