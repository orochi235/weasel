/**
 * `editAnchorsAction` — ongoing Action descriptor for editing polygon anchors.
 *
 *   - **Press** selects. Bare press replaces the anchor selection; Shift
 *     toggles the pressed anchor in or out of it. Pressing an anchor that
 *     is already part of a multi-anchor selection leaves the selection
 *     alone, so you can grab a set and move it.
 *   - **Drag** then moves whatever the press left selected — one anchor,
 *     or every selected anchor together.
 *   - **Dragging a control handle** moves just that handle, mirroring the
 *     opposite one while the anchor is smooth. Alt breaks the mirror; Shift
 *     holds the handle to the angle it had at the press, changing only its
 *     length.
 *
 * Selection lives on the `editAnchors` dep (flat anchor indices) rather
 * than in this handle's scratch, because the keyboard actions
 * (`nudgeAnchors`, `deleteAnchors`) and the overlay all need to read it
 * between gestures.
 *
 * Operational when the consumer wires the `editAnchors` dep, and
 * `buildAffordanceAt` with a `getAnchorState` thunk so the dispatcher
 * classifies anchor/control-handle hits as `anchor:N`, `controlIn:N`, or
 * `controlOut:N` affordances on pointerdown. On any other affordance `start`
 * returns `{}` so other bindings can handle the drag.
 */

import type { Action } from '@weasel-js/routing';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { EditAnchorsDep } from '../depSchema';
import { isAnchorOrControl } from '@weasel-js/routing';
import {
  anchorAt,
  editAnchorSetTracked,
  handleAlongItsAngle,
  moveHandleTo,
  translateAnchorBy,
  type AnchorSet,
  type PointOrigin,
} from '@weasel-js/geom';
import { pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { inPlane, editingLayer } from '../planeInput';
import { pathEditPreview } from './preview';

/**
 * Parse an anchor affordance kind — `'anchor:N'` | `'controlIn:N'` |
 * `'controlOut:N'`, where N is the flat anchor index — or `null` when the
 * affordance is not an anchor kind.
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
  /** The dragged control handle's position at the press, for a handle drag. */
  handleOrigin: { x: number; y: number } | null;
  originPose: PolygonPath;
  currentPose: PolygonPath;
  /** Where each point of `currentPose` came from in `originPose`. */
  origins?: readonly (PointOrigin | null)[];
}

function track(scratch: EditAnchorsScratch, next: ReturnType<typeof editAnchorSetTracked>): void {
  if (!next) return;
  scratch.currentPose = next.path;
  scratch.origins = next.origins;
}

/** Static descriptor for the `editAnchors` Action. */
export const editAnchorsAction: Action & { requires: string[] } = inPlane({
  id: 'editAnchors',
  label: 'Edit Anchors',
  defaultBinding: {
    kind: 'drag',
    // Only matches drags whose pointerdown hit an anchor or control handle.
    // Ties moveAction's `selected-body` on specificity and registers after
    // it, so move declines these presses in `start`.
    target: { kindOf: isAnchorOrControl },
  },
  eligible: { capability: 'edits-anchors' },
  requires: ['selection', 'editAnchors'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, _opts): OngoingHandle {
      const dep = ctx.deps.editAnchors;
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

      // Decode once to validate the affordance index against the actual
      // geometry and to read the press origin. A stale affordance (the
      // path changed between pointerdown and now) fails here rather than
      // silently editing whichever anchor now holds that index.
      const decoded = pathToAnchors(worldPath) as AnchorSet;
      const origin = anchorAt(decoded, anchorInfo.anchorIndex);
      if (!origin) return {};
      if (anchorInfo.part === 'controlIn' && !origin.inHandle) return {};
      if (anchorInfo.part === 'controlOut' && !origin.outHandle) return {};

      let active = false;
      const preview = pathEditPreview(dep, editingId, () => (active ? scratch.currentPose : null));
      if (!preview) return {};

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

      const scratch: EditAnchorsScratch = {
        dep,
        id: editingId,
        anchorIndex: anchorInfo.anchorIndex,
        part: anchorInfo.part,
        dragging,
        anchorOrigin: { x: origin.x, y: origin.y },
        handleOrigin: (anchorInfo.part === 'controlIn' ? origin.inHandle
          : anchorInfo.part === 'controlOut' ? origin.outHandle : null) ?? null,
        originPose: worldPath,
        currentPose: worldPath,
      };

      return {
        kind: 'edit-anchors',
        onMove(moveCtx: InvocationCtx): void {
          if (scratch.part === 'anchor') {
            if (scratch.dragging.length === 0) return;
            const dx = moveCtx.world.x - scratch.anchorOrigin.x;
            const dy = moveCtx.world.y - scratch.anchorOrigin.y;
            track(scratch, editAnchorSetTracked(scratch.originPose, (set) => {
              for (const flat of scratch.dragging) translateAnchorBy(set, flat, dx, dy);
            }));
          } else {
            const side = scratch.part === 'controlIn' ? 'in' : 'out';
            // Modifiers are read live so the user can press or release them mid-drag.
            const to = moveCtx.modifiers.shift && scratch.handleOrigin
              ? handleAlongItsAngle(scratch.anchorOrigin, scratch.handleOrigin, moveCtx.world)
              : moveCtx.world;
            track(scratch, editAnchorSetTracked(scratch.originPose, (set) =>
              moveHandleTo(
                set,
                scratch.anchorIndex,
                side,
                to.x,
                to.y,
                moveCtx.modifiers.alt,
              ),
            ));
          }
          active = true;
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          active = false;
          if (reason === 'cancel') return;
          if (scratch.originPose === scratch.currentPose) return;
          scratch.dep.applyEdit(scratch.id, scratch.currentPose, 'Edit anchors', scratch.origins);
        },
        previewIds: preview.previewIds,
        previewPose: preview.previewPose,
        previewData: preview.previewData,
      };
    },
  },
  enabled: () => true,
}, editingLayer);
