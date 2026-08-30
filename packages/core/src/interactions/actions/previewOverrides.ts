/**
 * Publishing an in-flight gesture's poses where the *scene* can see them.
 *
 * An ongoing action keeps its per-frame poses in its own scratch and exposes
 * them as `previewIds` / `previewPose`. That surface is enough to paint a
 * ghost and to size selection chrome, but it is invisible to anything that
 * asks the scene where a node is — `scenePoseLookup`, which resolves a derived
 * node's geometry, and the pick source, which decides what the pointer can
 * grab. A node deriving its path from a dragged one therefore stayed anchored
 * to the pre-drag position and jumped on drop.
 *
 * These publish the same frame into the scene's ephemeral override table, the
 * one channel both of those already read. Nothing here reaches `executeAndLog`,
 * so a drag still commits as exactly one undo entry.
 */
import type { NodeId, Scene } from 'core/scene/types';

/** The scratch fields these operate on. Actions carry more; this is the part
 *  that has to agree across them. */
export interface PreviewOverrideState {
  scene: Scene<unknown, string, unknown>;
  /** This frame's poses, keyed by node id — the action's own buffer. */
  previews: Map<NodeId, unknown>;
  /** The entry published per id, held by reference so a frame mutates it in
   *  place. Initialize to an empty map in the action's scratch. */
  overrideEntries: Map<NodeId, { pose: unknown }>;
}

/**
 * Publish `previews` as scene overrides. Call once per frame, after every
 * pass that can add to `previews` (a layout reflow, a cascade).
 *
 * Entries are set once and mutated in place, then published with a single
 * `commit()` — `PoseOverrides.set` notifies subscribers per call, so setting
 * every id every frame would fan out one repaint per node.
 */
export function syncPreviewOverrides(state: PreviewOverrideState): void {
  const { overrides } = state.scene;
  for (const [id, pose] of state.previews) {
    const existing = state.overrideEntries.get(id);
    if (existing) {
      existing.pose = pose;
      continue;
    }
    const entry = { pose };
    state.overrideEntries.set(id, entry);
    overrides.set(id, entry);
  }
  // An id can leave the preview set mid-gesture — a cascade child whose
  // container stopped being the drag root, a layout sibling that stopped
  // reflowing. Left published, it would pin that node to a stale frame.
  for (const id of state.overrideEntries.keys()) {
    if (state.previews.has(id)) continue;
    state.overrideEntries.delete(id);
    overrides.clear(id);
  }
  overrides.commit();
}

/**
 * Drop everything this gesture published. Call on both ends — on commit the
 * document poses take over, on cancel the untouched originals do.
 *
 * On commit, call it *after* the ops land: dropping first leaves a window in
 * which the scene answers with the pre-gesture pose.
 */
export function dropPreviewOverrides(state: PreviewOverrideState): void {
  if (state.overrideEntries.size === 0) return;
  for (const id of state.overrideEntries.keys()) state.scene.overrides.clear(id);
  state.overrideEntries.clear();
  state.scene.overrides.commit();
}
