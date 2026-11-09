/**
 * Where a node's stored pose sits relative to world. A node inside a
 * frame-defining container stores its pose in that container's frame, so its
 * editable path or outline, read from the stored pose alone, is not where it
 * draws.
 */
import type { NodeId, Scene } from 'core/scene/types';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import { scenePoseFrame } from 'interactions/actions/poseFrame';

/** The two directions between a node's stored pose and its world pose. */
export interface NodeFrame {
  /** A pose as the node stores it, in world. */
  world(stored: unknown): unknown;
  /** A world pose as the node stores it. */
  local(world: unknown): unknown;
}

type FramedShape = { id: string; parent?: string | null; pose: unknown };

/** `node`'s frame, or null where its stored pose is already world: a root, or
 *  a polygon pose, which draws as stored. */
export function nodeFrameOf(
  scene: Pick<Scene<unknown, string, unknown>, 'get'>,
  node: FramedShape | null | undefined,
): NodeFrame | null {
  if (node?.parent == null || !isRectPose(node.pose)) return null;
  const frame = scenePoseFrame(scene as Scene<unknown, string, unknown>);
  const parent = frame.parentWorld(node.id as NodeId);
  if (parent === null) return null;
  const { compose, decompose } = frame.pc;
  return { world: (stored) => compose(parent, stored), local: (world) => decompose(parent, world) };
}

/** `shape` with its pose in world under `frame`. */
export function shownIn<S extends { pose: unknown }>(frame: NodeFrame | null, shape: S): S {
  return frame ? { ...shape, pose: frame.world(shape.pose) } : shape;
}

/** Node `id` of `scene` with its pose in world, or undefined when missing. */
export function shownNodeOf(
  scene: Pick<Scene<unknown, string, unknown>, 'get'>,
  id: string,
): ReturnType<Scene<unknown, string, unknown>['get']> {
  const node = scene.get(id as NodeId);
  return node && shownIn(nodeFrameOf(scene, node), node);
}
