/** The 3D world every dep is built from: core's scene with a `Pose3`, the
 *  viewport it is seen through, and how wide each node is. */

import {
  composeWorldPose, scenePoseAdapter, scenePoseFrame, type NodeId, type Scene, type SceneNode,
} from '@weasel-js/core';
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
  /** The axis gestures resolve against. Default `+y`. */
  up?: Vec3;
}

export const DEFAULT_UP: Vec3 = { x: 0, y: 1, z: 0 };

/**
 * Where `id` is in world, as it is shown: folded up through every container
 * frame above it under the scene's composition, at the pose an in-flight
 * gesture published where there is one. What a renderer draws the node at.
 */
export function worldPoseOf<TData, TLayer extends string>(
  scene: Scene3d<TData, TLayer>,
  id: NodeId,
): Pose3 | undefined {
  return scene.get(id) === undefined ? undefined : worldPoses(scene, 'shown')(id);
}

/** Which world a read sees: as shown, or as the document holds it with no
 *  gesture's override anywhere up the chain. */
export type Reading = 'shown' | 'document';

/** A world-pose lookup over `scene`, to build once per pass and ask per node. */
export function worldPoses<TData, TLayer extends string>(
  scene: Scene3d<TData, TLayer>,
  reading: Reading,
): (id: NodeId) => Pose3 {
  const untyped = scene as unknown as Scene<unknown, string, unknown>;
  if (reading === 'shown') {
    const frame = scenePoseFrame(untyped);
    return (id) => frame.world(id) as Pose3;
  }
  const adapter = scenePoseAdapter(untyped);
  const compose = scene.composition.compose as (p: unknown, c: unknown) => unknown;
  return (id) => composeWorldPose(adapter, id as string, compose) as Pose3;
}

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
  reading: Reading,
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

/** A box with no extent at `p`. */
export function pointBox(p: Vec3): Aabb {
  return { min: p, max: p };
}
