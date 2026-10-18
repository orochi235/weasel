/**
 * Anchor-editing Actions beyond the drag itself — the keyboard and
 * marquee half of path editing.
 *
 * ## Why these don't collide with their node-level counterparts
 *
 * Each has a node-level twin bound to the same gesture: `deleteAction`
 * (Delete/Backspace), `nudge.*` (arrows), `areaSelectAction` (drag on
 * empty). Two mechanisms keep them apart, and both are needed:
 *
 *   - **Capability eligibility**, when a mode registry is wired. The
 *     node-level twins gate on `edits-page` / `transforms-selection` /
 *     `creates-selection`, none of which `path-edit` mode allows, so the
 *     dispatcher filters them out before matching.
 *   - **`enabled` fall-through**, for the many consumers with no mode
 *     registry at all. There the eligibility filter is skipped entirely,
 *     so these actions report themselves disabled unless a path is
 *     actually being edited with anchors selected, and the dispatcher
 *     moves on to the node-level twin. That needs the keyboard actions
 *     registered ahead of their twins, which `useStandardActions` does.
 *
 * Relying on eligibility alone would break every non-modal consumer;
 * relying on `enabled` alone would let a node-level action fire inside
 * path-edit mode. See `anchorEditing.test.ts`.
 */

import type { Action } from '@weasel-js/routing';
import { ActionDisabledReason, roleReader, type ModifierRoles } from '@weasel-js/routing';
import type { ActionDeps } from '@weasel-js/routing';
import type { ImmediateInvoker, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { EditAnchorsDep, PathSymmetryDep } from '../depSchema';
import { editedPathSymmetries } from '../edit-anchors/symmetry';
import {
  anchorsInRect,
  deleteAnchorsAt,
  editAnchorSetTracked,
  openSubpathAt,
  translateAnchorsSymmetric,
  type AnchorSet,
} from '@weasel-js/geom';
import { pathToAnchors, type PolygonPath } from '@weasel-js/geom';
import { pxExtent } from '@weasel-js/geom';
import { selectionAfterAnchorPress } from '../edit-anchors/action';
import { deleteSelectedMark, markUnder } from './pathEditMarks';
import { inPlane, editingLayer } from '../planeInput';
import { NUDGE_KEY, NUDGE_LABEL, nudgeDelta, type NudgeDirection } from './nudgeSteps';
import { icon } from '../../../icons.gen';
import { pathEditToolActive } from './pathEditTools';
import { pathOperationTags } from '../pathGestureTags';

/** Screen-pixel radius for "this click landed on an anchor". */
export const ANCHOR_CLICK_PX = 10;

/** `targets.anchorClickPx`, else `ANCHOR_CLICK_PX`, in world units through the view; with no view, one
 *  pixel is one unit. */
function anchorClickSlop(deps: ActionDeps | undefined): number {
  const px = deps?.kitSettings?.get('targets.anchorClickPx') ?? ANCHOR_CLICK_PX;
  const scale = deps?.view?.get().scale;
  if (!scale) return px;
  const extent = pxExtent(px, scale);
  return Math.max(extent.x, extent.y);
}

/** The `editAnchors` dep while a path is open, or null. */
export function depOf(deps: ActionDeps | undefined): EditAnchorsDep | null {
  const dep = deps?.editAnchors;
  if (!dep || !dep.editingId) return null;
  return dep;
}

/** The edited node's world-space polygon, or null when unavailable. */
function worldPathOf(dep: EditAnchorsDep): PolygonPath | null {
  const p = dep.getEditablePath(dep.editingId) as PolygonPath | undefined;
  if (!p || p.kind !== 'polygon') return null;
  return p;
}

/**
 * Decode → mutate → encode → commit, in one history entry. Returns false
 * when the edit changed nothing, so callers can skip the commit rather
 * than push an empty undo step.
 */
export function commitAnchorEdit(
  dep: EditAnchorsDep,
  label: string,
  edit: (set: AnchorSet) => boolean | void,
): boolean {
  const worldPath = worldPathOf(dep);
  if (!worldPath) return false;
  const next = editAnchorSetTracked(worldPath, edit);
  if (!next) return false;
  dep.applyEdit(dep.editingId, next.path, label, next.origins);
  return true;
}

/** Whether `edit` would change the edited path, tried on a scratch decode. */
export function anchorEditWouldChange(deps: ActionDeps | undefined, edit: (set: AnchorSet) => boolean | void): boolean {
  const dep = depOf(deps);
  const path = dep ? worldPathOf(dep) : null;
  return path !== null && editAnchorSetTracked(path, edit) !== null;
}

/** Enabled while a path is open and no path-edit tool has the pointer. */
function plainAnchorEditing(deps?: ActionDeps): true | ActionDisabledReason {
  if (!depOf(deps)) return ActionDisabledReason.SelectionRequired;
  return pathEditToolActive(deps) ? ActionDisabledReason.NotApplicable : true;
}

/** Enabled only while a path is in edit mode with anchors selected. */
export function requiresAnchorSelection(deps?: ActionDeps): true | ActionDisabledReason {
  const dep = depOf(deps);
  if (!dep || dep.selectedAnchors.size === 0) return ActionDisabledReason.SelectionRequired;
  return true;
}

/**
 * Click an anchor to select it; Shift-click to toggle it in or out of the
 * selection. Clicking away from every anchor clears the anchor selection.
 *
 * A click action and not part of `editAnchorsAction.start`: the dispatcher
 * only dispatches a drag binding once the pointer crosses the drag
 * threshold, so a press that never moves never reaches `start` at all.
 * Clicks, in turn, carry no affordance (the dispatcher attaches those to
 * `pointerdown` only), so this resolves the anchor from the click's world
 * coords.
 *
 * **Non-modal caveat:** `useSelectTool` binds `clearSelection` to
 * `{ click, target: 'empty', mods: {} }` at active scope, which outranks
 * this ambient binding. In path-edit mode that action is filtered out by
 * capability, so anchor clicks win. In a consumer with no mode registry
 * there's no filtering, so clicking an anchor that happens to sit over
 * empty canvas clears the node selection instead of selecting the anchor.
 * Anchors over the path body are unaffected.
 */
export const selectAnchorAction: Action & { requires: string[] } = inPlane({
  id: 'selectAnchor',
  label: 'Select anchor',
  tags: pathOperationTags('click'),
  defaultBinding: [
    { spec: { kind: 'click', mods: {} },              opts: { params: { additive: false } } },
    { spec: { kind: 'click', mods: { shift: true } }, opts: { params: { additive: true } } },
  ],
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'view', 'kitSettings'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const dep = depOf(deps);
      if (!dep) return;
      const wx = params?.worldX as number | undefined;
      const wy = params?.worldY as number | undefined;
      if (typeof wx !== 'number' || typeof wy !== 'number') return;
      const worldPath = worldPathOf(dep);
      if (!worldPath) return;

      const hit = nearestAnchorIndex(worldPath, wx, wy, anchorClickSlop(deps));
      const additive = params?.additive === true;
      if (hit === -1) {
        // Missed every anchor: an extension's mark is next. Otherwise a bare
        // click clears, and a shift-click leaves the selection alone.
        const mark = markUnder(dep, deps, wx, wy);
        if (mark) dep.setSelectedMark?.(mark);
        else if (!additive) {
          dep.setSelectedAnchors([]);
          dep.setSelectedMark?.(null);
        }
        return;
      }
      dep.setSelectedAnchors(selectionAfterAnchorPress(dep.selectedAnchors, hit, additive));
    },
  } as ImmediateInvoker,
  enabled: plainAnchorEditing,
}, editingLayer);

const NUDGE_ICON = {
  right: icon('nudgeAnchors'),
  up: icon('nudgeAnchorsUp'),
  down: icon('nudgeAnchorsDown'),
  left: icon('nudgeAnchorsLeft'),
} as const;

/**
 * Move the selected anchors by one step. Shift multiplies the step. Every
 * keystroke is its own history entry.
 */
function makeNudgeAnchorsAction(dir: NudgeDirection): Action & { requires: string[] } {
  return {
    id: `nudgeAnchors.${dir}`,
    label: `Nudge Anchors ${NUDGE_LABEL[dir]}`,
    group: 'nudgeAnchors',
    icon: NUDGE_ICON[dir],
    defaultBinding: [
      { spec: { kind: 'key', key: NUDGE_KEY[dir] },                        opts: { params: { magnitude: 'small' } } },
      { spec: { kind: 'key', key: NUDGE_KEY[dir], mods: { shift: true } }, opts: { params: { magnitude: 'big' } } },
    ],
    eligible: { capability: 'edits-anchors' },
    requires: ['editAnchors', 'pathSymmetry'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const dep = depOf(deps);
        if (!dep || dep.selectedAnchors.size === 0) return;
        const { dx, dy } = nudgeDelta(dir, params?.magnitude);
        const selected = [...dep.selectedAnchors];
        const symmetry = (deps as { pathSymmetry?: PathSymmetryDep } | undefined)?.pathSymmetry;
        commitAnchorEdit(dep, 'Nudge anchor', (set) => translateAnchorsSymmetric(
          set, selected, dx, dy, editedPathSymmetries(symmetry, dep.editingId, set)));
      },
    } as ImmediateInvoker,
    enabled: requiresAnchorSelection,
  };
}

/** Move the selected anchors up one step; Shift for a big step. */
export const nudgeAnchorsUpAction    = makeNudgeAnchorsAction('up');
/** Move the selected anchors down one step; Shift for a big step. */
export const nudgeAnchorsDownAction  = makeNudgeAnchorsAction('down');
/** Move the selected anchors left one step; Shift for a big step. */
export const nudgeAnchorsLeftAction  = makeNudgeAnchorsAction('left');
/** Move the selected anchors right one step; Shift for a big step. */
export const nudgeAnchorsRightAction = makeNudgeAnchorsAction('right');

/**
 * Delete the selected anchors, refitting the surrounding curve through
 * each gap so the path keeps its shape.
 *
 * Deleting renumbers every anchor after the lowest deleted index, so the
 * selection is cleared rather than left pointing at whatever slid into
 * those slots. A selected extension mark, which excludes an anchor
 * selection, is deleted instead.
 */
export const deleteAnchorsAction: Action & { requires: string[] } = {
  id: 'deleteAnchors',
  label: 'Delete Anchors',
  tags: pathOperationTags('command'),
  defaultBinding: {
    kind: 'key',
    key: ['Delete', 'Backspace'],
    phase: [{ channel: '*', phase: 'initial' }],
  },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const dep = depOf(deps);
      if (!dep || deleteSelectedMark(dep) || dep.selectedAnchors.size === 0) return;
      const doomed = [...dep.selectedAnchors];
      const changed = commitAnchorEdit(dep, 'Delete anchor', (set) =>
        deleteAnchorsAt(set, doomed),
      );
      if (changed) dep.setSelectedAnchors([]);
    },
  } as ImmediateInvoker,
  enabled: (deps) => (depOf(deps)?.selectedMark ? true : requiresAnchorSelection(deps)),
};

/**
 * Open a closed subpath at the alt+shift-clicked anchor.
 *
 * Bound to Alt+Shift+click rather than plain Alt+click so it doesn't
 * collide with `insertPathAnchorAction`, which is already Alt+click on
 * the same path.
 *
 * No-ops on an open subpath: there's nothing to cut.
 */
export const cutPathAtAnchorAction: Action & { requires: string[] } = inPlane({
  id: 'cutPathAtAnchor',
  label: 'Cut path at anchor',
  tags: pathOperationTags('click'),
  defaultBinding: { kind: 'click', mods: { alt: true, shift: true } },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors', 'view', 'kitSettings'],
  invoker: {
    timing: 'immediate',
    run: (deps, params) => {
      const dep = depOf(deps);
      if (!dep) return;
      const wx = params?.worldX as number | undefined;
      const wy = params?.worldY as number | undefined;
      if (typeof wx !== 'number' || typeof wy !== 'number') return;
      const worldPath = worldPathOf(dep);
      if (!worldPath) return;

      // Clicks carry no affordance (only pointerdown does), so this resolves
      // the hit itself.
      const nearest = nearestAnchorIndex(worldPath, wx, wy, anchorClickSlop(deps));
      if (nearest === -1) return;

      const changed = commitAnchorEdit(dep, 'Cut path', (set) => openSubpathAt(set, nearest));
      // Cutting rotates the subpath's anchor order, so held indices are stale.
      if (changed) dep.setSelectedAnchors([]);
    },
  } as ImmediateInvoker,
  enabled: (deps) => (depOf(deps) ? true : ActionDisabledReason.SelectionRequired),
}, editingLayer);

/** Flat index of the anchor nearest `(wx, wy)` within `slop`, else -1. */
function nearestAnchorIndex(
  path: PolygonPath,
  wx: number,
  wy: number,
  slop: number,
): number {
  let best = -1;
  let bestD2 = slop * slop;
  let flat = 0;
  for (const sub of (pathToAnchors(path) as AnchorSet).anchors) {
    for (const a of sub) {
      const dx = a.x - wx;
      const dy = a.y - wy;
      const d2 = dx * dx + dy * dy;
      // `<=` so an exact-slop hit counts; ties go to the earlier anchor.
      if (d2 <= bestD2 && (best === -1 || d2 < bestD2)) {
        bestD2 = d2;
        best = flat;
      }
      flat++;
    }
  }
  return best;
}

/** Shift on the press adds the marqueed anchors to the selection. */
export const MARQUEE_ANCHORS_ROLES = {
  'selection.add': { label: 'Add to the anchor selection', keys: ['shift'] },
} as const satisfies ModifierRoles;

const addHeld = roleReader(MARQUEE_ANCHORS_ROLES);

/**
 * Rubber-band select anchors by dragging on empty canvas while a path is
 * in edit mode.
 *
 * Shift adds to the existing anchor selection instead of replacing it.
 * The in-flight rect goes on the `editAnchors` dep so the path-editing
 * overlay can draw it.
 */
export const marqueeAnchorsAction: Action & { requires: string[] } = inPlane({
  id: 'marqueeAnchors',
  label: 'Marquee-select anchors',
  tags: pathOperationTags('drag'),
  defaultBinding: { kind: 'drag', target: 'empty' },
  eligible: { capability: 'edits-anchors' },
  modifierRoles: MARQUEE_ANCHORS_ROLES,
  requires: ['editAnchors'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx): OngoingHandle {
      const dep = depOf(ctx.deps);
      // Not editing → decline so the dispatcher falls through to the
      // node-level areaSelect.
      if (!dep) return {};
      const worldPath = worldPathOf(dep);
      if (!worldPath) return {};

      const additive = addHeld(ctx, 'selection.add');
      const base = new Set(dep.selectedAnchors);
      const start = { x: ctx.world.x, y: ctx.world.y };

      const rectFrom = (cx: number, cy: number) => ({
        x: Math.min(start.x, cx),
        y: Math.min(start.y, cy),
        width: Math.abs(cx - start.x),
        height: Math.abs(cy - start.y),
      });

      return {
        kind: 'marquee-anchors',
        onMove(moveCtx: InvocationCtx): void {
          const rect = rectFrom(moveCtx.world.x, moveCtx.world.y);
          dep.setMarquee(rect);
          // Live selection preview: the user sees anchors light up as the
          // band sweeps them, rather than only on release.
          const hits = anchorsOfPathInRect(worldPath, rect);
          dep.setSelectedAnchors(additive ? new Set([...base, ...hits]) : hits);
        },
        onEnd(_endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          dep.setMarquee(null);
          if (reason === 'cancel') dep.setSelectedAnchors(base);
        },
      };
    },
  },
  // A path-edit tool has the drag.
  enabled: (deps) => (pathEditToolActive(deps) ? ActionDisabledReason.NotApplicable : true),
}, editingLayer);

/** Flat indices of `path`'s anchors inside `rect`. */
function anchorsOfPathInRect(
  path: PolygonPath,
  rect: { x: number; y: number; width: number; height: number },
): number[] {
  return anchorsInRect(pathToAnchors(path) as AnchorSet, rect);
}
