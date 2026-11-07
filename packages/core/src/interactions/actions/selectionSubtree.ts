import { outermost } from '@weasel-js/select';
import type { NodeId, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import { withoutPageStructure } from 'core/scene/nodeGates';
import type { PoseFrame } from './poseFrame';
import { translatePoseViaDescriptor, type PoseDescriptor } from 'core/geometry/poseDescriptor';

type AnyScene = Scene<unknown, string, unknown>;

/** The ids in `ids` that are in the scene and that no ancestor in `ids` holds, less pages and the
 *  page run, which no action copies or moves. */
export function selectedRoots(scene: AnyScene, ids: readonly string[]): NodeId[] {
  const parentOf = (id: string) => scene.get(asNodeId(id))?.parent ?? null;
  return withoutPageStructure(scene, outermost(ids, parentOf).map((id) => asNodeId(id)))
    .filter((id) => scene.get(id) !== undefined);
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
 * node in the set, which that frame carries.
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
  return [...moving].filter((id) => {
    const storedIn = frame.frame(id);
    return storedIn === null || !moving.has(storedIn);
  });
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
  if (frame.frame(id) === null) return { dx, dy };
  const world = frame.world(id);
  const from = descriptor.getBounds(frame.local(id, world));
  const to = descriptor.getBounds(frame.local(id, translatePoseViaDescriptor(world, dx, dy, descriptor)));
  return { dx: to.x - from.x, dy: to.y - from.y };
}
