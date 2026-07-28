/**
 * `editAnchorsAction` — ongoing Action descriptor for editing polygon anchors.
 *
 * Owns the whole press-on-an-anchor gesture, because pressing and dragging
 * an anchor are two outcomes of one interaction rather than two
 * interactions:
 *
 *   - **Press** selects. Bare press replaces the anchor selection; Shift
 *     toggles the pressed anchor in or out of it. Pressing an anchor that
 *     is already part of a multi-anchor selection leaves the selection
 *     alone, so you can grab a set and move it.
 *   - **Drag** then moves whatever the press left selected — one anchor,
 *     or every selected anchor together.
 *   - **Dragging a control handle** moves just that handle, mirroring the
 *     opposite one while the anchor is smooth. Alt breaks the mirror.
 *
 * Selection lives on the `editAnchors` dep (flat anchor indices) rather
 * than in this handle's scratch, because the keyboard actions
 * (`nudgeAnchors`, `deleteAnchors`) and the overlay all need to read it
 * between gestures.
 *
 * ## Wiring
 *
 * The descriptor is operational when the consumer wires:
 *   1. `buildAffordanceAt` with a `getAnchorState` thunk so the dispatcher
 *      classifies anchor/control-handle hits as `anchor:N`, `controlIn:N`,
 *      or `controlOut:N` affordances on pointerdown.
 *   2. The `editAnchors` dep in the DepSchema.
 *
 * When `ctx.drag.affordance` is absent or is not an anchor/control kind,
 * `start` returns `{}` (no-op) so other bindings can handle the drag.
 *
 * @see buildAffordanceAt — the classifier that produces anchor affordances.
 * @see anchorEdits — the pure geometry these handlers drive.
 */

import type { Action } from '../registry';
import type { InvocationCtx, OngoingHandle } from '../invoker';
import type { EditAnchorsDep } from '../depSchema';
import { isAnchorOrControl } from '../../dispatcher/predicates';
import {
  anchorAt,
  editAnchorSet,
  moveHandleTo,
  translateAnchorBy,
  type AnchorSet,
} from 'features/paths/anchorEdits';
import { pathToAnchors } from 'features/paths/anchors';
import { worldEditToStorage } from 'features/paths/pathInWorld';
// Commit goes through dep.applyEdit (routes setPose or setPose+update
// based on the node's path-storage shape); no direct op or dispatch
// helpers needed here.
import type { PolygonPath } from 'features/paths/types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Parse an anchor affordance kind string into the anchor it names.
 * Returns `null` when the affordance is not an anchor kind.
 *
 * Format: `'anchor:N'` | `'controlIn:N'` | `'controlOut:N'`, where N is the
 * flat anchor index — the same numbering `enumerateAnchors` produces and
 * `anchorEdits` addresses by.
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

/**
 * Resolve what a press on `anchorIndex` should leave selected.
 *
 * Shift toggles. A bare press on an anchor that's already part of the
 * selection keeps the selection intact (so the drag moves the whole set);
 * a bare press anywhere else collapses to just that anchor.
 */
export function selectionAfterAnchorPress(
  current: ReadonlySet<number>,
  anchorIndex: number,
  additive: boolean,
): Set<number> {
  if (additive) {
    const next = new Set(current);
    if (next.has(anchorIndex)) next.delete(anchorIndex);
    else next.add(anchorIndex);
    return next;
  }
  if (current.has(anchorIndex) && current.size > 1) return new Set(current);
  return new Set([anchorIndex]);
}

// ---------------------------------------------------------------------------
// Internal scratch
// ---------------------------------------------------------------------------

interface EditAnchorsScratch {
  dep: EditAnchorsDep;
  id: string;
  anchorIndex: number;
  /** `'anchor'` drags on-curve points (and their handles) by a delta.
   *  `'controlIn'` / `'controlOut'` drag one control point to an absolute
   *  world coord. */
  part: 'anchor' | 'controlIn' | 'controlOut';
  /** Anchors this drag moves — the pressed one, or the whole anchor
   *  selection when the press landed inside it. Flat indices. */
  dragging: readonly number[];
  /** World position of the pressed anchor at drag start; the drag delta is
   *  measured from here rather than accumulated per move, so the geometry
   *  is always derived from `originPose` in one step. */
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
      // node.pose; for data.path nodes it's pathInWorld-projected (translate +
      // rotation) so the anchor world coords match what the user clicked.
      const worldPath = dep.getEditablePath(editingId) as PolygonPath | undefined;
      if (!worldPath || worldPath.kind !== 'polygon') return {};
      const storageKind = dep.getStorageKind(editingId);
      if (storageKind !== 'pose' && storageKind !== 'data') return {};

      // Decode once to validate the affordance index against the actual
      // geometry and to read the press origin. A stale affordance (the
      // path changed between pointerdown and now) fails here rather than
      // silently editing whichever anchor now holds that index.
      const decoded = pathToAnchors(worldPath) as AnchorSet;
      const origin = anchorAt(decoded, anchorInfo.anchorIndex);
      if (!origin) return {};
      if (anchorInfo.part === 'controlIn' && !origin.inHandle) return {};
      if (anchorInfo.part === 'controlOut' && !origin.outHandle) return {};

      // --- Press semantics: selection updates immediately, before any move.
      let dragging: readonly number[] = [anchorInfo.anchorIndex];
      if (anchorInfo.part === 'anchor') {
        const next = selectionAfterAnchorPress(
          dep.selectedAnchors,
          anchorInfo.anchorIndex,
          ctx.modifiers.shift,
        );
        dep.setSelectedAnchors(next);
        // Shift-pressing an anchor OUT of the selection must not then drag
        // it; drag whatever the press left selected, intersected with the
        // pressed anchor's membership.
        dragging = next.has(anchorInfo.anchorIndex)
          ? [...next]
          : [];
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
        dragging,
        anchorOrigin: { x: origin.x, y: origin.y },
        originPose: worldPath,
        currentPose: worldPath,
        storageKind,
      };

      let active = false;

      return {
        kind: 'edit-anchors',
        onMove(moveCtx: InvocationCtx): void {
          if (scratch.part === 'anchor') {
            if (scratch.dragging.length === 0) return;
            const dx = moveCtx.world.x - scratch.anchorOrigin.x;
            const dy = moveCtx.world.y - scratch.anchorOrigin.y;
            const next = editAnchorSet(scratch.originPose, (set) => {
              for (const flat of scratch.dragging) translateAnchorBy(set, flat, dx, dy);
            });
            if (next) scratch.currentPose = next;
          } else {
            const side = scratch.part === 'controlIn' ? 'in' : 'out';
            const next = editAnchorSet(scratch.originPose, (set) =>
              moveHandleTo(
                set,
                scratch.anchorIndex,
                side,
                moveCtx.world.x,
                moveCtx.world.y,
                // Alt breaks the smooth mirror for this drag — read live so
                // the user can press or release Alt mid-drag.
                moveCtx.modifiers.alt,
              ),
            );
            if (next) scratch.currentPose = next;
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
          // data.path: invert the world edit the same way the commit does, so
          // the preview ghost (which re-applies pose.rotation via the render
          // wrap) matches the committed result — no double-rotation.
          if (!originRectPose) return null;
          return worldEditToStorage(originRectPose, scratch.currentPose).pose;
        },
        previewData: (id: string): unknown | null => {
          if (!active || id !== scratch.id) return null;
          if (scratch.storageKind !== 'data') return null;
          if (!originData) return null;
          // Stored path is the unrotated, origin-aligned contour; the render
          // invariant `pathInWorld(stored, pose) === world` holds.
          const { path } = worldEditToStorage(originRectPose!, scratch.currentPose);
          return { ...originData, path };
        },
      };
    },
  },
  enabled: () => true,
};
