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
