/**
 * `cloneAction` — ongoing Action descriptor for alt-drag clone.
 *
 * ## Status: REAL (scene-direct, no overlay)
 *
 * Implements the core clone-by-drag logic via insert ops committed through
 * `scene.applyBatch`:
 *   - `start`: validates selection + scene; captures origin poses for all
 *     selected nodes. The alt-modifier check that activates cloning in
 *     `useClone` (via `CloneBehavior.activates`) is intentionally NOT applied
 *     here — the descriptor fires when the dispatcher routes to it; modifier
 *     discrimination is a dispatcher concern (Phase 12 TODO for alt-gating).
 *   - `onMove`: tracks current drag delta in scratch (no scene writes).
 *   - `onEnd('commit')`: emits one insert op per selected node (translated
 *     pose) and commits them as a single batch — via the consumer `applyOps`
 *     hook when present, else `scene.applyBatch(ops, 'Clone', ...)`. One
 *     undo entry for the whole batch.
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
import type { Node, Scene, NodeId } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import type { Op } from 'core/ops/types';
import { createInsertOp } from 'core/ops/create';
import { defaultCommitAdapter } from '../defaultCommitAdapter';

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

/** Mint a fresh NodeId for a clone target. The old `scene.add(spec)` path
 *  (no explicit id) let the scene generate a random id, so the produced id
 *  was never deterministic/observable — pre-generating one here to feed the
 *  insert op preserves behavior. Mirrors the scene's default id scheme
 *  (`n{counter}-{random}`), which `core/scene/scene.ts` keeps module-private. */
let cloneIdCounter = 0;
function freshCloneId(): NodeId {
  return asNodeId(`n${(cloneIdCounter++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
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
  /** Optional consumer commit hook captured at gesture start. When present,
   *  the insert ops route through it (consumer history) instead of
   *  `scene.applyBatch`. Undefined → fall back to `scene.applyBatch`. */
  applyOps?: (ops: Op[], label: string) => void;
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
 * Commits insert ops via `scene.applyBatch(ops, 'Clone', ...)` (or the
 * consumer `applyOps` hook) for a single undo entry.
 *
 * @see useClone — the React hook this descriptor partially mirrors.
 */
export const cloneAction: Action & { requires: string[] } = {
  id: 'clone',
  label: 'Clone',
  defaultBinding: { kind: 'drag' },
  eligible: { capability: ['edits-page', 'creates-selection'] },
  requires: ['selection', 'scene', 'applyOps'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const selection = ctx.deps.selection as SelectionApi | undefined;
      const scene = ctx.deps.scene as Scene<unknown, string, unknown> | undefined;
      const applyOps = ctx.deps.applyOps as ((ops: Op[], label: string) => void) | undefined;

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
        applyOps,
      };

      return {
        kind: 'clone',
        // Clone: source stays visible at its committed pose; the ghost
        // (rendered via previewIds/previewPose below) appears at the
        // drag target. Opt out of the default "hide source" behavior
        // move/resize/rotate use.
        previewHidesSource: false,
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

          // Build one insert op per clone target — same nodes/values the old
          // direct `scene.add` loop produced (kind/layer/data/parent preserved,
          // pose translated by the drag delta), then route the batch through the
          // consumer `applyOps` hook when present (so an app with its own history
          // captures the clone as a single undo entry); otherwise commit straight
          // to the scene's own history. One applyOps / applyBatch call =
          // one undo entry, matching the prior single `scene.batch('Clone', …)`.
          const ops: Op[] = [];
          for (const id of scratch.ids) {
            const origin = scratch.originPoses.get(id);
            const originNode = scratch.scene.get(id);
            if (origin === undefined || !originNode) continue;
            const newPose = translatePose(origin, dx, dy);
            // The old `scene.add` (no explicit id) minted a random id; we
            // pre-generate one so the insert op carries a full node. Id value
            // was never observable, so behavior is preserved.
            const node = {
              id: freshCloneId(),
              kind: originNode.kind,
              layer: originNode.layer,
              pose: newPose,
              data: originNode.data,
              parent: originNode.parent ?? null,
            } as Node<unknown, string, unknown>;
            ops.push(createInsertOp<Node<unknown, string, unknown>>({ node, label: 'Clone' }));
          }
          if (ops.length > 0) {
            if (scratch.applyOps) scratch.applyOps(ops, 'Clone');
            else scratch.scene.applyBatch(ops, 'Clone', defaultCommitAdapter(scratch.scene));
          }
          scratch.previews.clear();
        },
        previewIds: () => scratch.previews.keys(),
        previewPose: (id: string) => scratch.previews.get(id as NodeId) ?? null,
      };
    },
  },
  enabled: () => true,
};
