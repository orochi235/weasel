/**
 * `cloneAction` — ongoing Action descriptor for alt-drag clone (Phase 11).
 *
 * ## Status: REAL (scene-direct, no overlay)
 *
 * Implements the core clone-by-drag logic via `scene.add` + `scene.batch`:
 *   - `start`: validates selection + scene; captures origin poses for all
 *     selected nodes. The alt-modifier check that activates cloning in
 *     `useClone` (via `CloneBehavior.activates`) is intentionally NOT applied
 *     here — the descriptor fires when the dispatcher routes to it; modifier
 *     discrimination is a dispatcher concern (Phase 12 TODO for alt-gating).
 *   - `onMove`: tracks current drag delta in scratch (no scene writes).
 *   - `onEnd('commit')`: emits a single `scene.batch('Clone', ...)` that
 *     calls `scene.add(...)` for each selected node with the translated pose.
 *     Produces one undo entry for the whole batch.
 *   - `onEnd('cancel')`: no-op (scene never mutated during drag).
 *
 * ## What this does NOT wire (vs `useClone`)
 *
 * - Modifier gate: `useClone` only activates when `CloneBehavior.activates(mods)`
 *   returns true (typically alt-held). The descriptor lacks that gate — it runs
 *   whenever the dispatcher routes `clone`. Proper alt-gating requires a modifier-
 *   discriminant in the dispatcher (Phase 12 TODO).
 * - Overlay: `useClone` renders a ghost via `setOverlay / clearOverlay`. The
 *   descriptor has no overlay surface (deferred to Phase 7 overlay system).
 * - `expandIds`: group expansion is omitted; only leaf poses are cloned.
 * - Custom `CloneBehavior.onEnd` ops (e.g. `cloneByAltDrag`): the descriptor
 *   uses a simpler `scene.add` path that does not delegate to behavior `onEnd`.
 *   Behavior-pipeline cloning waits for a later phase.
 *
 * ## Pose generics
 *
 * Poses are translated using the same `{x, y, ...}` generic spread as
 * `moveAction`. Non-rect poses with custom layout (e.g. paths) should register
 * a custom clone action with a typed geometry dep.
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';
import type { Scene, NodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Translate a rect-shaped pose by (dx, dy). */
function translatePose(pose: unknown, dx: number, dy: number): unknown {
  const p = pose as Record<string, unknown>;
  return {
    ...p,
    x: ((p['x'] as number) ?? 0) + dx,
    y: ((p['y'] as number) ?? 0) + dy,
  };
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface CloneScratch {
  ids: NodeId[];
  scene: Scene<unknown, string, unknown>;
  /** Origin poses captured at drag start. */
  originPoses: Map<NodeId, unknown>;
  /** Running drag delta — updated each onMove, applied once at commit. */
  currentDelta: { dx: number; dy: number };
  /** Preview poses keyed by ORIGINAL node id (the clone targets don't have
   *  scene ids yet; the preview-ghost layer paints the originals' silhouette
   *  at the translated pose — original stays visible at its committed home,
   *  ghost appears at the drag target). */
  previews: Map<NodeId, unknown>;
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `clone` Action.
 *
 * Requires dep-schema entries: `selection`, `scene`.
 *
 * Clones selected nodes into new scene nodes translated by the drag delta.
 * Uses `scene.batch('Clone', ...)` for a single undo entry.
 *
 * @see useClone — the React hook this descriptor partially mirrors.
 */
export const cloneAction: Action & { requires: string[] } = {
  id: 'clone',
  label: 'Clone',
  defaultBinding: { kind: 'drag' },
  requires: ['selection', 'scene'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;

      if (!selection || !scene) return {};

      const ids = selection.get() as NodeId[];
      if (ids.length === 0) return {};

      // Capture origin poses once at drag start.
      const originPoses = new Map<NodeId, unknown>();
      for (const id of ids) {
        const node = scene.get(id);
        if (node) originPoses.set(id, node.pose);
      }

      if (originPoses.size === 0) return {};

      const scratch: CloneScratch = {
        ids,
        scene,
        originPoses,
        currentDelta: { dx: 0, dy: 0 },
        previews: new Map<NodeId, unknown>(),
      };

      return {
        kind: 'clone',
        onMove(moveCtx: InvocationCtx): void {
          if (!moveCtx.drag) return;
          scratch.currentDelta = {
            dx: moveCtx.drag.delta.x,
            dy: moveCtx.drag.delta.y,
          };
          // Preview: paint each original's silhouette at the translated pose.
          // The original stays at its committed location (we don't hide it);
          // the ghost overlay shows where the new copy will land on commit.
          scratch.previews.clear();
          const { dx, dy } = scratch.currentDelta;
          if (dx === 0 && dy === 0) return;
          for (const [id, origin] of scratch.originPoses) {
            scratch.previews.set(id, translatePose(origin, dx, dy));
          }
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') {
            scratch.previews.clear();
            return;
          }
          const { dx, dy } = scratch.currentDelta;
          // Zero-delta drag — no clone.
          if (dx === 0 && dy === 0) {
            scratch.previews.clear();
            return;
          }

          scratch.scene.batch('Clone', () => {
            for (const id of scratch.ids) {
              const origin = scratch.originPoses.get(id);
              const originNode = scratch.scene.get(id);
              if (origin === undefined || !originNode) continue;
              const newPose = translatePose(origin, dx, dy);
              scratch.scene.add({
                kind: originNode.kind,
                layer: originNode.layer,
                pose: newPose,
                data: originNode.data,
                parent: originNode.parent ?? undefined,
              });
            }
          });
          scratch.previews.clear();
        },
        previewIds: () => scratch.previews.keys(),
        previewPose: (id: string) => scratch.previews.get(id as NodeId) ?? null,
      };
    },
  },
  enabled: () => true,
};
