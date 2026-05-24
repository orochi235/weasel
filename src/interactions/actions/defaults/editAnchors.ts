/**
 * `editAnchorsAction` — ongoing Action descriptor for editing polygon anchors.
 *
 * ## Status: REAL (Phase 14d-anchors)
 *
 * The descriptor is fully operational when the consumer wires:
 *   1. `buildAffordanceAt` with a `getAnchorState` thunk so the dispatcher
 *      classifies anchor/control-handle hits as `anchor:N`, `controlIn:N`,
 *      or `controlOut:N` affordances on pointerdown.
 *   2. The `editAnchors` dep in the DepSchema (Phase 14b entry).
 *
 * The invoker reads `ctx.drag.affordance.kind` to identify the hit anchor,
 * derives the coord index from `enumerateAnchors`, and on every `onMove`
 * writes the new absolute world position via `withCoord`. On `onEnd('commit')`
 * it dispatches a `createTransformOp` through `dispatchApplyBatch` so the
 * edit is undoable.
 *
 * When `ctx.drag.affordance` is absent or is not an anchor/control kind,
 * `start` returns `{}` (no-op) so other bindings can handle the drag.
 *
 * @see useEditAnchors — the React hook this descriptor mirrors.
 * @see buildAffordanceAt — the classifier that produces anchor affordances.
 */

import type { Action } from '../registry';
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
 * Static descriptor for the `editAnchors` Action.
 *
 * Requires dep-schema entries: `selection`, `editAnchors`.
 *
 * The invoker reads `ctx.drag.affordance.kind` to identify the anchor hit.
 * If the affordance is absent or not an anchor kind, `start` returns `{}`
 * (no-op), allowing other bindings to handle the drag.
 *
 * Consumers must provide `buildAffordanceAt` with a `getAnchorState` thunk
 * so that anchor handles are classified at pointerdown.
 *
 * @see useEditAnchors — the React hook this descriptor mirrors.
 */
export const editAnchorsAction: Action & { requires: string[] } = {
  id: 'editAnchors',
  label: 'Edit Anchors',
  defaultBinding: {
    kind: 'drag',
    // Target predicate: this binding only matches drags whose pointerdown
    // hit an anchor or control-handle affordance. Higher specificity than
    // bare `{ kind: 'drag' }` of moveAction et al, so editAnchors wins on
    // anchor drags via matchSorted's specificity ordering — no opt-out
    // needed in the general-drag actions.
    target: {
      kindOf: (hit: unknown): boolean => {
        if (typeof hit !== 'object' || hit === null) return false;
        const kind = (hit as { kind?: unknown }).kind;
        return typeof kind === 'string'
          && /^(anchor|controlIn|controlOut):/.test(kind);
      },
    },
  },
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

      let active = false;

      return {
        onMove(moveCtx: InvocationCtx): void {
          scratch.currentPose = withCoord(
            scratch.originPose,
            scratch.coordIndex,
            moveCtx.world.x,
            moveCtx.world.y,
          );
          active = true;
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          active = false;
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
        previewIds: () => (active ? [scratch.id] : null),
        previewPose: (id: string) =>
          active && id === scratch.id ? scratch.currentPose : null,
      };
    },
  },
  enabled: () => true,
};
