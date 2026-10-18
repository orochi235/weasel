import type { NodeId, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { PoseFrame } from './poseFrame';
import { poseDescriptorForNode, translatePoseViaDescriptor, type PoseDescriptor } from 'core/geometry/poseDescriptor';

type AnyScene = Scene<unknown, string, unknown>;

/** True when any ancestor of `id` is also in `set` — acting on that ancestor
 *  already reaches this node, so acting on it again would double it. */
export function hasSelectedAncestor(scene: AnyScene, id: NodeId, set: ReadonlySet<string>): boolean {
  let parent = scene.get(id)?.parent ?? null;
  while (parent != null) {
    if (set.has(parent)) return true;
    parent = scene.get(parent)?.parent ?? null;
  }
  return false;
}

/** The ids in `ids` that are in the scene and have no selected ancestor. */
export function selectedRoots(scene: AnyScene, ids: readonly string[]): NodeId[] {
  const set = new Set<string>(ids);
  return ids
    .map((id) => asNodeId(id))
    .filter((id) => scene.get(id) !== undefined && !hasSelectedAncestor(scene, id, set));
}

/** Whether `id` draws a path derived from other nodes. Its pose is a
 *  placeholder: the path follows the nodes it derives from. */
function derivesPathOnly(scene: AnyScene, id: string): boolean {
  const node = scene.get(asNodeId(id));
  return node?.derivePath !== undefined && node.derivePose === undefined
    && Array.isArray(node.dependsOn) && node.dependsOn.length > 0;
}

/**
 * The nodes a translation of `ids` has to act on. A node whose pose is derived
 * from an id list cannot be moved itself, since a pose written to it is
 * overwritten on the next read, so the nodes it derives from stand in for it,
 * through however many derived nodes that takes. A node reached that way which
 * derives only its path — a wire under a label — follows its own dependencies
 * and is not written. Each id appears once, in the order it was first reached.
 */
export function moveSources(scene: AnyScene, ids: readonly string[]): string[] {
  const out = new Set<string>();
  const walked = new Set<string>();
  const visit = (id: string, reached: boolean): void => {
    if (walked.has(id)) return;
    walked.add(id);
    if (reached && derivesPathOnly(scene, id)) return;
    const node = scene.get(asNodeId(id));
    const deps = node?.derivePose !== undefined && Array.isArray(node.dependsOn) ? node.dependsOn : [];
    if (deps.length === 0) out.add(id);
    else for (const dep of deps) visit(dep, true);
  };
  for (const id of ids) visit(id, false);
  return [...out];
}

/**
 * The nodes a resize, rotation, flip, or alignment of `ids` has to write. A
 * node whose pose is derived cannot be written itself, so what it derives
 * from stands in for it — a container's children, or the ids a node names —
 * through however many derived nodes that takes, leaving out one reached that
 * way which derives only its path, as {@link moveSources} does. Each id appears once, in the order it
 * was first reached.
 */
export function shapeSources(scene: AnyScene, ids: readonly string[]): string[] {
  const out = new Set<string>();
  const walked = new Set<string>();
  const visit = (id: string, reached: boolean): void => {
    if (walked.has(id)) return;
    walked.add(id);
    if (reached && derivesPathOnly(scene, id)) return;
    const node = scene.get(asNodeId(id));
    const deps = node?.derivePose === undefined
      ? []
      : node.dependsOn === 'children' ? scene.childrenOf(asNodeId(id)) : node.dependsOn ?? [];
    if (deps.length === 0 && node?.dependsOn !== 'children') out.add(id);
    else for (const dep of deps) visit(dep, true);
  };
  for (const id of ids) visit(id, false);
  return [...out];
}

/** `id` and everything under it, a parent ahead of its children. */
export function subtreeIds(scene: AnyScene, id: NodeId): NodeId[] {
  const out: NodeId[] = [];
  const walk = (at: NodeId): void => {
    out.push(at);
    for (const child of scene.childrenOf(at)) walk(child);
  };
  walk(id);
  return out;
}

/**
 * The nodes whose stored pose has to change for `ids` to move as a unit: each
 * selected node and its descendants, less any stored in the frame of another
 * node in the set, which that frame carries. With the default absolute poses
 * nothing is carried and every descendant is written.
 */
export function translateTargets(
  scene: AnyScene,
  frame: PoseFrame<unknown>,
  ids: readonly string[],
): NodeId[] {
  const moving = new Set<NodeId>();
  for (const root of selectedRoots(scene, ids)) {
    for (const id of subtreeIds(scene, root)) moving.add(id);
  }
  if (frame.pc.closure === 'identity') return [...moving];
  return [...moving].filter((id) => {
    const storedIn = frame.frame(id);
    return storedIn === null || !moving.has(storedIn);
  });
}

/**
 * Move each of `moves` by its own delta, taking along whatever has to be
 * written for that node to move as a unit ({@link translateTargets}). Every
 * world pose is read before the first write, so one move cannot shift what a
 * later one reads. Call inside a `scene.batch`.
 */
export function translateEach(
  scene: AnyScene,
  frame: PoseFrame<unknown>,
  descriptor: PoseDescriptor<unknown>,
  moves: readonly { id: string; dx: number; dy: number }[],
): void {
  const writes: { id: NodeId; to: unknown }[] = [];
  const seen = new Set<NodeId>();
  for (const { id, dx, dy } of moves) {
    if (dx === 0 && dy === 0) continue;
    for (const target of translateTargets(scene, frame, [id])) {
      if (seen.has(target)) continue;
      seen.add(target);
      const node = scene.get(target);
      if (!node) continue;
      const d = poseDescriptorForNode(descriptor, node);
      writes.push({ id: target, to: frame.local(target, translatePoseViaDescriptor(frame.world(target), dx, dy, d)) });
    }
  }
  for (const { id, to } of writes) scene.setPose(id, to);
}

/** The world translation `(dx, dy)` as a translation of `id`'s stored pose,
 *  which under a turned frame points another way. */
export function storedDelta(
  frame: PoseFrame<unknown>,
  descriptor: PoseDescriptor<unknown>,
  id: NodeId,
  dx: number,
  dy: number,
): { dx: number; dy: number } {
  if (frame.pc.closure === 'identity' || frame.frame(id) === null) return { dx, dy };
  const world = frame.world(id);
  const from = descriptor.getBounds(frame.local(id, world));
  const to = descriptor.getBounds(frame.local(id, translatePoseViaDescriptor(world, dx, dy, descriptor)));
  return { dx: to.x - from.x, dy: to.y - from.y };
}
