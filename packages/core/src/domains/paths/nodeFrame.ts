/**
 * Where a node's stored pose sits relative to world. A node inside a
 * frame-defining container stores its pose in that container's frame, so its
 * editable path or outline, read from the stored pose alone, is not where it
 * draws.
 */
import type { NodeId, Scene } from 'core/scene/types';
import { isRectPose } from 'core/geometry/autoPoseDescriptor';
import { scenePoseFrame, type PoseReading } from 'interactions/actions/poseFrame';
import { documentPose, effectivePose, type PosedNode, type PoseSource } from 'core/scene/effectivePose';

/** The two directions between a node's stored pose and its world pose. */
export interface NodeFrame {
  /** A pose as the node stores it, in world. */
  world(stored: unknown): unknown;
  /** A world pose as the node stores it, or `null` when the frame is singular. */
  local(world: unknown): unknown;
  /** Whether the frame inverts. A node in a singular frame draws flat, and no
   *  edit made to what it shows can be stored back: path edits leave it alone. */
  inverts: boolean;
}

/** What a frame lookup reads of a node: its id, its parent, and its stored pose. */
export type FramedNode = { id: string; parent?: string | null; pose: unknown };

/** `node`'s frame, or null where its stored pose is already world: a root, or
 *  a polygon pose, which draws as stored. */
export function nodeFrameOf(
  scene: Scene<unknown, string, unknown>,
  node: FramedNode | null | undefined,
): NodeFrame | null {
  return nodeFramesOf(scene)(node);
}

/** {@link nodeFrameOf} for many nodes of `scene`, building the scene's pose
 *  frame once, at the first node that needs it. */
export function nodeFramesOf(
  scene: Scene<unknown, string, unknown>,
): (node: FramedNode | null | undefined) => NodeFrame | null {
  let frame: ReturnType<typeof scenePoseFrame> | null = null;
  return (node) => {
    if (node?.parent == null || !isRectPose(node.pose)) return null;
    frame ??= scenePoseFrame(scene);
    return frameUnder(frame, node.id);
  };
}

function frameUnder(frame: ReturnType<typeof scenePoseFrame>, id: string): NodeFrame | null {
  const parent = frame.parentWorld(id as NodeId);
  if (parent === null) return null;
  const { compose, decompose } = frame.pc;
  return {
    world: (stored) => compose(parent, stored),
    local: (world) => decompose(parent, world),
    inverts: decompose(parent, parent) !== null,
  };
}

/** Whether an edit to what `node` shows can be stored back: false in a singular frame. */
export function storesEdits(
  scene: Scene<unknown, string, unknown>,
  node: FramedNode | null | undefined,
): boolean {
  return nodeFrameOf(scene, node)?.inverts ?? true;
}

/** `shape` with its pose in world under `frame`. */
export function shownIn<S extends { pose: unknown }>(frame: NodeFrame | null, shape: S): S {
  return frame ? { ...shape, pose: frame.world(shape.pose) } : shape;
}

/** `node` at the pose `reading` sees, still in its parent's frame: drawn at, an
 *  override's included (`effectivePose`), or as the document derives or stores it. */
export function drawnNodeOf<S extends FramedNode>(
  scene: Scene<unknown, string, unknown>,
  node: S,
  reading: PoseReading = 'shown',
): S {
  const read = reading === 'shown' ? effectivePose : documentPose;
  const pose = read(scene as unknown as PoseSource<unknown>, node as unknown as PosedNode<unknown>);
  return pose === node.pose ? node : { ...node, pose };
}

/** Node `id` of `scene` at the pose `reading` sees, in world, or undefined when missing. */
export function shownNodeOf(
  scene: Scene<unknown, string, unknown>,
  id: string,
  reading: PoseReading = 'shown',
): ReturnType<Scene<unknown, string, unknown>['get']> {
  const node = scene.get(id as NodeId);
  return node && shownIn(nodeFrameOf(scene, node), drawnNodeOf(scene, node, reading));
}
