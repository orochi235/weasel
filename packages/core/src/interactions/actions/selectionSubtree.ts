import type { NodeId, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { PoseFrame } from './poseFrame';

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

/**
 * The nodes a translation of `ids` has to act on. A node whose pose is derived
 * from an id list cannot be moved itself, since a pose written to it is
 * overwritten on the next read, so the nodes it derives from stand in for it,
 * through however many derived nodes that takes. Each id appears once, in the
 * order it was first reached.
 */
export function moveSources(scene: AnyScene, ids: readonly string[]): string[] {
  const out = new Set<string>();
  const walked = new Set<string>();
  const visit = (id: string): void => {
    if (walked.has(id)) return;
    walked.add(id);
    const node = scene.get(asNodeId(id));
    const deps = node?.derivePose !== undefined && Array.isArray(node.dependsOn) ? node.dependsOn : [];
    if (deps.length === 0) out.add(id);
    else for (const dep of deps) visit(dep);
  };
  for (const id of ids) visit(id);
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
