import type { NodeId, Scene } from 'core/scene/types';

/** Whether removing `ids` would reach a locked node: one of them, anything in their subtrees, or a dependent the
 *  removal cascades to. An action that moves or removes these is disabled while it does (ruled 2026-11-09), and
 *  its `run` reads this too, so the two never disagree. */
export function reachesLocked(scene: Scene<unknown, string, unknown>, ids: readonly NodeId[]): boolean {
  if (ids.length === 0) return false;
  return scene.removalClosure(ids).some((id) => scene.isLocked(id));
}
