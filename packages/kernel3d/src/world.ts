/** The 3D world every dep is built from: core's scene with a `Pose3`, the
 *  viewport it is seen through, and how wide each node is. */

import type { Scene, SceneNode } from '@weasel-js/core';
import type { Aabb, Vec3 } from '@weasel-js/geom/3d';
import { aabbOfPose, type Pose3 } from './pose3';
import type { ViewportSource } from './project';

/** A 3D scene is core's scene with a `Pose3`. Nothing wraps it. */
export type Scene3d<TData, TLayer extends string> = Scene<TData, TLayer, Pose3>;
/** A node of a `Scene3d`. */
export type Node3d<TData, TLayer extends string> = SceneNode<TData, TLayer, Pose3>;

/**
 * The world box a node occupies, rather than a local box to transform: a
 * sphere's box is the same under every rotation, and no transform of a local
 * box reproduces that — rotate a cube and it widens.
 *
 * Omitted, a node is a unit cube carried by its pose.
 *
 * A function of the node alone; a result that depends on anything else must
 * come with a scene change, or picks go stale.
 */
export type NodeBounds<TData, TLayer extends string> = (
  node: Node3d<TData, TLayer>,
) => Aabb;

/** What every 3D dep is built from: the scene, the viewport, and optionally
 *  each node's world box. */
export interface World3d<TData, TLayer extends string> {
  scene: Scene3d<TData, TLayer>;
  viewport: ViewportSource;
  bounds?: NodeBounds<TData, TLayer>;
  /** The axis gestures resolve against. Default `+y`. */
  up?: Vec3;
}

export const DEFAULT_UP: Vec3 = { x: 0, y: 1, z: 0 };

export function boundsOfNode<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  node: Node3d<TData, TLayer>,
): Aabb {
  return world.bounds ? world.bounds(node) : aabbOfPose(node.pose);
}
