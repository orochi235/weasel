/** The 3D world every dep is built from: core's scene with a `Pose3`, the
 *  viewport it is seen through, and how wide each node is. */

import type { Scene, SceneNode } from '@weasel-js/core/engine';
import { worldPoses, type PoseReading } from '@weasel-js/core';
import { type NodeId } from '@weasel-js/routing';
import type { Aabb, Vec3 } from '@weasel-js/geom/3d';
import { aabbOfPose, type Pose3 } from './pose3';
import type { Viewport3d, ViewportSource } from './project';

/** A 3D scene is core's scene with a `Pose3`. Nothing wraps it. */
export type Scene3d<TData, TLayer extends string> = Scene<TData, TLayer, Pose3>;
/** A node of a `Scene3d`. */
export type Node3d<TData, TLayer extends string> = SceneNode<TData, TLayer, Pose3>;

/**
 * The world box a node occupies, rather than a local box to transform: a
 * sphere's box is the same under every rotation, and no transform of a local
 * box reproduces that — rotate a cube and it widens.
 *
 * The node it is handed carries its world pose: under container composition,
 * or mid-gesture, that is not the pose the scene stores. `null` means the node
 * occupies nothing, so nothing picks it or snaps to it; a container that only
 * groups its children answers that.
 *
 * Omitted, a mark is a unit cube carried by its pose and a group occupies
 * nothing.
 *
 * A function of the node alone; a result that depends on anything else must
 * come with a scene change, or picks go stale.
 */
export type NodeBounds<TData, TLayer extends string> = (
  node: Node3d<TData, TLayer>,
) => Aabb | null;

/** What every 3D dep is built from: the scene, the viewport, and optionally
 *  each node's world box. */
export interface World3d<TData, TLayer extends string> {
  scene: Scene3d<TData, TLayer>;
  viewport: ViewportSource;
  bounds?: NodeBounds<TData, TLayer>;
  /** The axis gestures resolve against, and the one every camera seen through `viewport` orbits about and keeps
   *  upright on screen. Default `+y`. */
  up?: Vec3;
}

export const DEFAULT_UP: Vec3 = { x: 0, y: 1, z: 0 };

/** `viewport` seen in `world`: its camera turning about the world's up. */
export function inWorld<TData, TLayer extends string>(world: Pick<World3d<TData, TLayer>, 'up'>, viewport: Viewport3d): Viewport3d {
  return { ...viewport, up: world.up ?? DEFAULT_UP };
}

/** The viewport the view `viewId` looks through in `world`, its camera turning about the world's up. */
export function viewportOf<TData, TLayer extends string>(
  world: Pick<World3d<TData, TLayer>, 'viewport' | 'up'>,
  viewId: string | null | undefined,
): Viewport3d {
  return inWorld(world, world.viewport(viewId));
}

// One world-pose reading for 2D and 3D alike: core's, typed by the scene's pose.
export { worldPoseOf, worldPoses } from '@weasel-js/core';

/** The box `node` occupies at the world pose `pose`, or `null` for none. */
export function boxAt<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  node: Node3d<TData, TLayer>,
  pose: Pose3,
): Aabb | null {
  if (world.bounds) return world.bounds(pose === node.pose ? node : { ...node, pose });
  return node.kind === 'group' ? null : aabbOfPose(pose);
}

/** The box `node` is measured by at `pose`, and a gesture casts it from: its
 *  own, or for a node that occupies nothing, its origin. */
export function measuredBoxAt<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  node: Node3d<TData, TLayer>,
  pose: Pose3,
): Aabb {
  return boxAt(world, node, pose) ?? pointBox(pose.position);
}

/** A world-box lookup over `world`, to build once per pass and ask per node. */
export function worldBoxes<TData, TLayer extends string>(
  world: World3d<TData, TLayer>,
  reading: PoseReading,
): (node: Node3d<TData, TLayer>) => Aabb | null {
  const poseOf = worldPoses(world.scene, reading);
  return (node) => boxAt(world, node, poseOf(node.id));
}

/** `ids` and everything under them. */
export function withDescendants<TData, TLayer extends string>(
  scene: Scene3d<TData, TLayer>,
  ids: Iterable<string>,
): Set<string> {
  const out = new Set<string>();
  const queue = [...ids];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (out.has(id)) continue;
    out.add(id);
    queue.push(...scene.childrenOf(id as NodeId));
  }
  return out;
}

/** Whether a BVH can hold `box`: finite, and no side inverted. */
export function boxIndexable({ min, max }: Aabb): boolean {
  return (
    Number.isFinite(min.x) && Number.isFinite(min.y) && Number.isFinite(min.z) &&
    Number.isFinite(max.x) && Number.isFinite(max.y) && Number.isFinite(max.z) &&
    min.x <= max.x && min.y <= max.y && min.z <= max.z
  );
}

/** A box with no extent at `p`. */
export function pointBox(p: Vec3): Aabb {
  return { min: p, max: p };
}
