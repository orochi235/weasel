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
 *     length; Mod (Cmd or Ctrl) holds its length, changing only its angle;
 *     both freeze it. The `editAnchors` dep's `handleLocks`, or else the
 *     `handleLock` param ({@link EditAnchorsParams}), holds a lock with no
 *     modifier. The lock in force draws its guide as a `polyline` overlay
 *     of role `lock`: the line, or the circle round the anchor.
 *   - **Path-edit extensions shape the drag** through their `drag`: anchors
 *     that follow an anchor drag by a share of it, where a dragged handle
 *     goes after the locks, the wheel mid-drag, and overlays of their own.
 *   - **Every frame is finished** by the dep's `finishEdit`, so what a
 *     path-edit extension keeps true holds while the drag runs.
 *   - **Under a `pathSymmetry` dep**, on a path that is its own image under
 *     some of its transforms, every image of what is dragged follows it.
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
import type { BindingOpts, InvocationCtx, OngoingHandle, OngoingOverlay } from '@weasel-js/routing';
import type { EditAnchorsDep, SnapDep, SnapGeometry } from '../depSchema';
import { ActionDisabledReason, isAnchorOrControl, resolveParams, roleReader, type ModifierRoles } from '@weasel-js/routing';
import {
  anchorAt,
  editAnchorSetTracked,
  moveHandleSymmetric,
  moveHandleTo,
  pathAwayFromAnchors,
  translateAnchorsSymmetric,
  type AnchorSet,
  type AnchorSymmetry,
  type PenAnchor,
  type PointOrigin,
} from '@weasel-js/geom';
import { pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { inPlane, editingLayer } from '../planeInput';
import { HANDLE_LOCK_ROLES, lockHandle, locksInForce, type HandlePress } from './handleDrag';
import { locksOf, type EditAnchorsParams } from './params';
import { pathEditPreview } from './preview';
import {
  claimWheel, dragWeights, extensionOverlays, placeHandle, startExtensionDrags, translateWeighted,
} from './extensionDrags';
import type { PathEditDrag } from 'features/paths/pathEditExtension';
import { pathEditToolActive } from '../defaults/pathEditTools';
import { editedPathSymmetries } from './symmetry';
import { pathOperationTags } from '../pathGestureTags';

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
  /** The anchor and the dragged control handle at the press, for a handle drag. */
  handlePress: HandlePress | null;
  /** The guide the lock in force drew at the last move. */
  guide: OngoingOverlay | null;
  /** The path-edit extensions' shares of this drag. */
  drags: readonly PathEditDrag[];
  /** The last move, to redo when an extension claims the wheel. */
  lastMove: InvocationCtx | null;
  originPose: PolygonPath;
  currentPose: PolygonPath;
  /** The transforms `originPose` is its own image under, read at the press. */
  symmetries: readonly AnchorSymmetry[];
  /** Where each point of `currentPose` came from in `originPose`. */
  origins?: readonly (PointOrigin | null)[];
}

type Point = { x: number; y: number };

/**
 * An anchor drag's snap, from the press: where the pressed anchor goes for a
 * pointer at `world` — onto a path target in range, on another shape or on
 * the edited path's own anchors and segments that the drag leaves still.
 * Identity without a path snapper.
 */
function anchorDragSnap(
  snap: SnapDep | undefined,
  press: { id: string; origin: Point; originPose: PolygonPath; dragging: readonly number[] },
): (world: Point) => Point {
  const toTargets = snap?.toTargets;
  if (!toTargets) return (world) => world;
  // Built on the first move, and the same object after, so the snapper indexes it once.
  let still: SnapGeometry | undefined;
  return (world) => {
    if (!still) {
      const { path, anchors } = pathAwayFromAnchors(press.originPose, press.dragging);
      still = { paths: [path], anchors };
    }
    return toTargets(world, { origin: press.origin, exclude: [press.id], also: still }) ?? world;
  };
}

const paramsOf = (opts: BindingOpts | undefined): EditAnchorsParams =>
  (resolveParams(opts?.params) ?? {}) as EditAnchorsParams;

/** Take `next` as the frame to show, finished by the dep. A frame it cannot
 *  finish is dropped, so the path stays at the last one it could. */
function track(scratch: EditAnchorsScratch, next: ReturnType<typeof editAnchorSetTracked>): void {
  if (!next) return;
  const { dep, id } = scratch;
  const path = dep.finishEdit ? dep.finishEdit(id, next.path, next.origins) : next.path;
  if (!path) return;
  scratch.currentPose = path as PolygonPath;
  scratch.origins = next.origins;
}

/** The anchor and the handle a press on `part` grabbed; null for an anchor press. */
function handlePressOf(
  origin: PenAnchor,
  part: EditAnchorsScratch['part'],
): HandlePress | null {
  const handle = part === 'controlIn' ? origin.inHandle : part === 'controlOut' ? origin.outHandle : undefined;
  return handle ? { anchor: { x: origin.x, y: origin.y }, handle: { ...handle } } : null;
}

/** Move the dragged anchors to follow `to`, and the anchors the extensions
 *  weight by their shares. A weighted drag moves no symmetric images. */
function moveAnchors(scratch: EditAnchorsScratch, to: Point): void {
  if (scratch.dragging.length === 0) return;
  const dx = to.x - scratch.anchorOrigin.x;
  const dy = to.y - scratch.anchorOrigin.y;
  const weights = dragWeights(scratch.drags, scratch.dragging);
  track(scratch, editAnchorSetTracked(scratch.originPose, (set) => {
    if (weights) translateWeighted(set, weights, dx, dy);
    else translateAnchorsSymmetric(set, scratch.dragging, dx, dy, scratch.symmetries);
  }));
}

/** The modifiers `editAnchors` reads while it runs: Shift on the press adds
 *  to the anchor selection, Alt breaks a smooth anchor's mirror, and the
 *  handle locks. */
export const EDIT_ANCHORS_ROLES = {
  'selection.add': { label: 'Add to the anchor selection', keys: ['shift'] },
  'mirror.break': { label: "Break the handles' mirror", keys: ['alt'] },
  ...HANDLE_LOCK_ROLES,
} as const satisfies ModifierRoles;

const roleHeld = roleReader(EDIT_ANCHORS_ROLES);

/** Move the dragged handle toward the pointer, under the locks in force, then
 *  wherever the extensions place it. */
function moveHandle(scratch: EditAnchorsScratch, ctx: InvocationCtx, params: EditAnchorsParams): void {
  const side = scratch.part === 'controlIn' ? 'in' : 'out';
  // Modifiers and held locks are read live, so either can change mid-drag.
  const held = (ctx.deps.editAnchors ?? scratch.dep).handleLocks ?? locksOf(params.handleLock);
  const locks = locksInForce(held, ctx);
  const locked = scratch.handlePress ? lockHandle(scratch.handlePress, ctx.world, locks) : { to: ctx.world, guide: null };
  scratch.guide = locked.guide;
  const to = placeHandle(scratch.drags, locked.to, { locks });
  const alt = roleHeld(ctx, 'mirror.break');
  const move = scratch.symmetries.length > 0
    ? (set: AnchorSet) => moveHandleSymmetric(set, scratch.anchorIndex, side, to.x, to.y, alt, scratch.symmetries)
    : (set: AnchorSet) => moveHandleTo(set, scratch.anchorIndex, side, to.x, to.y, alt);
  track(scratch, editAnchorSetTracked(scratch.originPose, move));
}

/** Static descriptor for the `editAnchors` Action. */
export const editAnchorsAction: Action & { requires: string[] } = inPlane({
  id: 'editAnchors',
  label: 'Edit Anchors',
  tags: pathOperationTags('drag'),
  defaultBinding: {
    kind: 'drag',
    // Only matches drags whose pointerdown hit an anchor or control handle.
    // Ties moveAction's `selected-body` on specificity and registers after
    // it, so move declines these presses in `start`.
    target: { kindOf: isAnchorOrControl },
  },
  eligible: { capability: 'edits-anchors' },
  modifierRoles: EDIT_ANCHORS_ROLES,
  requires: ['selection', 'editAnchors', 'pathSymmetry', 'snap'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx, opts): OngoingHandle {
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
          roleHeld(ctx, 'selection.add'),
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
        handlePress: handlePressOf(origin, anchorInfo.part),
        guide: null,
        drags: startExtensionDrags(dep.extensions, {
          id: editingId,
          node: dep.getNodeShape(editingId),
          path: worldPath,
          anchors: decoded,
          part: anchorInfo.part,
          anchorIndex: anchorInfo.anchorIndex,
          dragging: anchorInfo.part === 'anchor' ? dragging : [],
          scale: ctx.deps.view?.get().scale,
        }),
        lastMove: null,
        originPose: worldPath,
        currentPose: worldPath,
        symmetries: editedPathSymmetries(ctx.deps.pathSymmetry, editingId, decoded),
      };
      const snapAnchor = anchorDragSnap(ctx.deps.snap, {
        id: editingId, origin: scratch.anchorOrigin, originPose: worldPath, dragging,
      });

      const move = (moveCtx: InvocationCtx): void => {
        scratch.lastMove = moveCtx;
        if (scratch.part === 'anchor') moveAnchors(scratch, snapAnchor(moveCtx.world));
        else moveHandle(scratch, moveCtx, paramsOf(opts));
      };

      return {
        kind: 'edit-anchors',
        onMove(moveCtx: InvocationCtx): void {
          move(moveCtx);
          active = true;
        },
        onWheel(wheelCtx: InvocationCtx): boolean {
          if (!wheelCtx.wheel || !claimWheel(scratch.drags, wheelCtx.wheel)) return false;
          if (scratch.lastMove) move(scratch.lastMove);
          return true;
        },
        overlay(): readonly OngoingOverlay[] | null {
          if (!active) return null;
          const extra = scratch.drags.length > 0
            ? extensionOverlays(scratch.drags, pathToAnchors(scratch.currentPose) as AnchorSet)
            : [];
          const all = scratch.guide ? [scratch.guide, ...extra] : extra;
          return all.length > 0 ? all : null;
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          active = false;
          ctx.deps.snap?.release?.();
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
  // A path-edit tool has the drag.
  enabled: (deps) => (pathEditToolActive(deps) ? ActionDisabledReason.NotApplicable : true),
}, editingLayer);
