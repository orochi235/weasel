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
import { isAnchorOrControl } from '../../dispatcher/predicates';
import { withCoord, enumerateAnchors, translateAnchor } from '../edit-anchors/geometry';
import { boundsOfPath } from 'features/paths/bounds';
import { translatePath } from 'features/paths/transform';
// Commit goes through dep.applyEdit (routes setPose or setPose+update
// based on the node's path-storage shape); no direct op or dispatch
// helpers needed here.
import type { PolygonPath } from 'features/paths/types';

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
  /** `'anchor'` drags the on-curve point and its attached handles by the
   *  same delta. `'controlIn'` / `'controlOut'` drag only the control
   *  point to the new absolute world coord. */
  part: 'anchor' | 'controlIn' | 'controlOut';
  /** For control drags: index in `coords` of the control point. For
   *  anchor drags: index of the anchor itself. */
  coordIndex: number;
  /** For anchor drags: the world position of the anchor at drag start.
   *  Used to compute the (dx, dy) translation. Unused for control drags. */
  anchorOrigin: { x: number; y: number };
  originPose: PolygonPath;
  currentPose: PolygonPath;
  /** Where the polygon lives on the node — drives which preview-ghost
   *  axes the handle populates (`previewPose` only for pose-as-polygon,
   *  `previewPose` + `previewData` for data.path). */
  storageKind: 'pose' | 'data';
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
    target: { kindOf: isAnchorOrControl },
  },
  eligible: { capability: 'edits-anchors' },
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
      // World-coord polygon. For pose-as-polygon nodes this equals
      // node.pose; for data.path nodes it's pathAtPose-projected so the
      // anchor world coords match what the user clicked.
      const worldPath = dep.getEditablePath(editingId) as PolygonPath | undefined;
      if (!worldPath || worldPath.kind !== 'polygon') return {};
      const storageKind = dep.getStorageKind(editingId);
      if (storageKind !== 'pose' && storageKind !== 'data') return {};

      const anchors = enumerateAnchors(worldPath);
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

      // For data.path nodes, we also need the original rect pose + data
      // so previewPose / previewData can be derived from currentPose.
      // Captured at start so onMove doesn't re-read the scene.
      const nodeShape = storageKind === 'data' ? dep.getNodeShape(editingId) : null;
      const originRectPose =
        nodeShape ? (nodeShape.pose as { x: number; y: number; width: number; height: number }) : undefined;
      const originData = nodeShape ? (nodeShape.data as object) : undefined;

      const scratch: EditAnchorsScratch = {
        dep,
        id: editingId,
        anchorIndex: anchorInfo.anchorIndex,
        part: anchorInfo.part,
        coordIndex,
        anchorOrigin: { x: anchor.x, y: anchor.y },
        originPose: worldPath,
        currentPose: worldPath,
        storageKind,
      };

      let active = false;

      return {
        kind: 'edit-anchors',
        onMove(moveCtx: InvocationCtx): void {
          if (scratch.part === 'anchor') {
            const dx = moveCtx.world.x - scratch.anchorOrigin.x;
            const dy = moveCtx.world.y - scratch.anchorOrigin.y;
            scratch.currentPose = translateAnchor(
              scratch.originPose,
              scratch.anchorIndex,
              dx,
              dy,
            );
          } else {
            scratch.currentPose = withCoord(
              scratch.originPose,
              scratch.coordIndex,
              moveCtx.world.x,
              moveCtx.world.y,
            );
          }
          active = true;
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          active = false;
          if (reason === 'cancel') return;
          if (scratch.originPose === scratch.currentPose) return;
          scratch.dep.applyEdit(scratch.id, scratch.currentPose, 'Edit anchors');
        },
        previewIds: () => (active ? [scratch.id] : null),
        previewPose: (id: string): unknown | null => {
          if (!active || id !== scratch.id) return null;
          if (scratch.storageKind === 'pose') {
            // Pose IS the polygon — preview pose is the polygon itself.
            return scratch.currentPose;
          }
          // data.path: pose is a rect, derived from the edited polygon's bounds.
          if (!originRectPose) return null;
          const b = boundsOfPath(scratch.currentPose);
          return { ...originRectPose, x: b.x, y: b.y, width: b.width, height: b.height };
        },
        previewData: (id: string): unknown | null => {
          if (!active || id !== scratch.id) return null;
          if (scratch.storageKind !== 'data') return null;
          if (!originData) return null;
          // Align the world polygon to the new pose origin so the kit's
          // render invariant (`pathAtPose(stored, pose) === world`) holds.
          const b = boundsOfPath(scratch.currentPose);
          const aligned = translatePath(scratch.currentPose, -b.x, -b.y);
          return { ...originData, path: aligned };
        },
      };
    },
  },
  enabled: () => true,
};
