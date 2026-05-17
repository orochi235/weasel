/**
 * `editAnchorsAction` — ongoing Action descriptor for editing polygon anchors.
 *
 * ## Status: PARTIAL (Phase 14b)
 *
 * The descriptor is registered and structurally correct. The invoker implements
 * the gesture phases (pointerdown → identify anchor → drag → commit) using:
 *   - `ctx.drag.affordance` to identify which anchor was hit at pointerdown.
 *     The affordance must carry `kind: 'anchor:N'` (anchor index N) or
 *     `kind: 'controlIn:N'` / `kind: 'controlOut:N'`. This requires the
 *     consumer's `buildAffordanceAt` to classify anchor handles in addition to
 *     resize/rotation handles (Phase 13 only wired resize + rotate).
 *   - `editAnchors` dep from DepSchema for reading/writing the polygon pose.
 *   - `withCoord` from the edit-anchors geometry module to update coord pairs.
 *   - `createTransformOp` for the undo-safe commit.
 *
 * ## What's PARTIAL
 *
 * The invoker **bails** (returns `{}`) when `ctx.drag.affordance` is absent or
 * is not an `anchor:*` / `controlIn:*` / `controlOut:*` affordance. This
 * means anchor editing via the action descriptor only works when the consumer
 * has wired an affordance classifier that returns anchor hits.
 *
 * Full wiring requires:
 * 1. Consumer extends `buildAffordanceAt` to hit-test anchor handles for
 *    the currently-editing polygon. The `editAnchors` dep carries `editingId`.
 * 2. Consumer provides the `editAnchors` dep (Phase 14b depSchema entry).
 *
 * ## Phase 14c follow-up TODO
 *
 * Wire the affordance extension in `<SceneCanvas>` / `buildAffordanceAt` to
 * classify anchor-handle hits when an `editAnchors` dep is registered.
 * Until then this descriptor is registered but inert when no affordance is
 * provided.
 *
 * @see useEditAnchors — the React hook this descriptor will fully mirror post-14c.
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';
import type { EditAnchorsDep } from '../depSchema';
import { withCoord, enumerateAnchors } from '../edit-anchors/geometry';
import { createTransformOp } from 'core/ops/transform';
import { dispatchApplyBatch } from 'core/applyOps';
import type { PolygonPath } from 'features/paths/types';
import type { Path } from 'features/paths/types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse an anchor affordance kind string into a coord-index usable by
 * `withCoord`. Returns `null` when the affordance is not an anchor kind.
 *
 * Format: `'anchor:N'` | `'controlIn:N'` | `'controlOut:N'`
 * where N is the anchorIndex. `withCoord` takes a `coordIndex` derived from
 * `enumerateAnchors`, but that requires the polygon. Since we receive only
 * the affordance kind at pointerdown, we store the raw anchor info and look
 * it up in the geometry on first move.
 */
function parseAnchorAffordance(
  kind: string,
): { anchorIndex: number; part: 'anchor' | 'controlIn' | 'controlOut' } | null {
  const m = kind.match(/^(anchor|controlIn|controlOut):(\d+)$/);
  if (!m) return null;
  return {
    anchorIndex: parseInt(m[2], 10),
    part: m[1] as 'anchor' | 'controlIn' | 'controlOut',
  };
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface EditAnchorsScratch {
  dep: EditAnchorsDep;
  id: string;
  anchorIndex: number;
  coordIndex: number;
  originPose: PolygonPath;
  currentPose: PolygonPath;
}

// ---------------------------------------------------------------------------
// Descriptor
// ---------------------------------------------------------------------------

/**
 * @experimental
 * Static descriptor for the `editAnchors` Action.
 *
 * Requires dep-schema entries: `selection`, `editAnchors`.
 *
 * The invoker reads `ctx.drag.affordance.kind` to identify the anchor hit.
 * If the affordance is absent or is not an anchor kind, `start` returns `{}`
 * (no-op). Full behavior requires the consumer to wire anchor-hit affordances.
 *
 * @see useEditAnchors — the React hook this descriptor partially mirrors.
 */
export const editAnchorsAction: Action & { requires: string[] } = {
  id: 'editAnchors',
  label: 'Edit Anchors',
  gestureBinding: { kind: 'drag' },
  requires: ['selection', 'editAnchors'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const dep = ctx.deps.editAnchors as EditAnchorsDep | undefined;
      if (!dep) return {};

      const affordance = ctx.drag?.affordance;
      if (!affordance) {
        // No affordance hit → this drag doesn't target an anchor handle.
        // Let other bindings handle it (the handle returns {}, dispatcher moves on).
        return {};
      }

      const anchorInfo = parseAnchorAffordance(affordance.kind);
      if (!anchorInfo) {
        // Affordance is a non-anchor kind (e.g. resize handle, rotate handle).
        return {};
      }

      const { editingId } = dep;
      const pose = dep.getPose(editingId) as Path | undefined;
      if (!pose || pose.kind !== 'polygon') return {};

      // Derive coordIndex from the polygon geometry.
      const anchors = enumerateAnchors(pose);
      const anchor = anchors[anchorInfo.anchorIndex];
      if (!anchor) return {};

      let coordIndex: number;
      switch (anchorInfo.part) {
        case 'anchor':
          coordIndex = anchor.coordIndex;
          break;
        case 'controlIn':
          if (!anchor.controlIn) return {};
          coordIndex = anchor.controlIn.coordIndex;
          break;
        case 'controlOut':
          if (!anchor.controlOut) return {};
          coordIndex = anchor.controlOut.coordIndex;
          break;
        default:
          return {};
      }

      const scratch: EditAnchorsScratch = {
        dep,
        id: editingId,
        anchorIndex: anchorInfo.anchorIndex,
        coordIndex,
        originPose: pose,
        currentPose: pose,
      };

      return {
        onMove(moveCtx: InvocationCtx): void {
          scratch.currentPose = withCoord(
            scratch.originPose,
            scratch.coordIndex,
            moveCtx.world.x,
            moveCtx.world.y,
          );
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          if (reason === 'cancel') return;
          if (scratch.originPose === scratch.currentPose) return;
          const op = createTransformOp<Path>({
            id: scratch.id,
            from: scratch.originPose,
            to: scratch.currentPose,
            label: 'Edit anchors',
          });
          dispatchApplyBatch(scratch.dep, [op], 'Edit anchors');
        },
      };
    },
  },
  enabled: () => ActionDisabledReason.SelectionRequired,
};
