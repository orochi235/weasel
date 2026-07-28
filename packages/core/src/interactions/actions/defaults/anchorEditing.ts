/**
 * Anchor-editing Actions beyond the drag itself — the keyboard and
 * marquee half of path editing.
 *
 * These were previously only reachable through the pen tool's private
 * edit mode, which no consumer could actually enter (its `getPathObj`
 * hook needed a `pose.kind` that no kit-created node has). Porting them
 * onto the Action layer puts them behind the same `editAnchors` dep,
 * `edits-anchors` capability, and undo path as `editAnchorsAction`.
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
 *     moves on to the node-level twin.
 *
 * Relying on eligibility alone would break every non-modal consumer;
 * relying on `enabled` alone would let a node-level action fire inside
 * path-edit mode. See `anchorEditing.test.ts`.
 */

import type { Action } from '../registry';
import { ActionDisabledReason } from '../registry';
import type { ActionDeps } from '../invoker';
import type { ImmediateInvoker, InvocationCtx, OngoingHandle } from '../invoker';
import type { EditAnchorsDep } from '../depSchema';
import {
  anchorsInRect,
  deleteAnchorsAt,
  editAnchorSet,
  openSubpathAt,
  translateAnchorBy,
  type AnchorSet,
} from 'features/paths/anchorEdits';
import { pathToAnchors } from 'features/paths/anchors';
import type { PolygonPath } from 'features/paths/types';
import { selectionAfterAnchorPress } from './editAnchors';

// ---------------------------------------------------------------------------
// Shared plumbing
// ---------------------------------------------------------------------------

/** Nudge step sizes — mirror `nudge.ts` so anchors and nodes move alike. */
const SMALL_STEP = 1;
const BIG_STEP = 10;

/** World-unit radius for "this click landed on an anchor". Matches the
 *  affordance hit radius closely enough that anything the user can see as
 *  an anchor marker is cuttable. */
const ANCHOR_CLICK_SLOP = 10;

function depOf(deps: ActionDeps | undefined): EditAnchorsDep | null {
  const dep = deps?.editAnchors as EditAnchorsDep | undefined;
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
function commitAnchorEdit(
  dep: EditAnchorsDep,
  label: string,
  edit: (set: Parameters<Parameters<typeof editAnchorSet>[1]>[0]) => boolean | void,
): boolean {
  const worldPath = worldPathOf(dep);
  if (!worldPath) return false;
  const next = editAnchorSet(worldPath, edit);
  if (!next) return false;
  dep.applyEdit(dep.editingId, next, label);
  return true;
}

/** Enabled only while a path is in edit mode with anchors selected. */
function requiresAnchorSelection(deps?: ActionDeps): true | ActionDisabledReason {
  const dep = depOf(deps);
  if (!dep || dep.selectedAnchors.size === 0) return ActionDisabledReason.SelectionRequired;
  return true;
}

// ---------------------------------------------------------------------------
// selectAnchor
// ---------------------------------------------------------------------------

/**
 * Click an anchor to select it; Shift-click to toggle it in or out of the
 * selection. Clicking away from every anchor clears the anchor selection.
 *
 * ## Why this is a click action and not part of the drag
 *
 * The obvious home for "pressing an anchor selects it" is
 * `editAnchorsAction.start`, since that's the handler that receives the
 * anchor affordance. It can't live there: the dispatcher only dispatches
 * a drag binding once the pointer crosses the drag threshold, so a press
 * that never moves never reaches `start` at all. Verified in the running
 * app — down/up on an anchor logs a bare `click`, and down/move-3px/up
 * logs the same; only a real drag logs `pointerdown → editAnchors`.
 *
 * Clicks, in turn, carry no affordance (the dispatcher attaches those to
 * `pointerdown` only), so this resolves the anchor from the click's world
 * coords — the same thing `insertPathAnchorAction` does for segments.
 * `editAnchorsAction` still syncs the selection when a drag begins on an
 * unselected anchor, so drag-without-clicking-first behaves too.
 *
 * **Non-modal caveat:** `useSelectTool` binds `clearSelection` to
 * `{ click, target: 'empty', mods: {} }` at active scope, which outranks
 * this ambient binding. In path-edit mode that action is filtered out by
 * capability, so anchor clicks win. In a consumer with no mode registry
 * there's no filtering, so clicking an anchor that happens to sit over
 * empty canvas clears the node selection instead of selecting the anchor.
 * Anchors over the path body are unaffected.
 */
export const selectAnchorAction: Action & { requires: string[] } = {
  id: 'selectAnchor',
  label: 'Select anchor',
  defaultBinding: [
    { spec: { kind: 'click', mods: {} },              opts: { params: { additive: false } } },
    { spec: { kind: 'click', mods: { shift: true } }, opts: { params: { additive: true } } },
  ],
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
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

      const hit = nearestAnchorIndex(worldPath, wx, wy, ANCHOR_CLICK_SLOP);
      const additive = params?.additive === true;
      if (hit === -1) {
        // Missed every anchor. A bare click clears; a shift-click leaves
        // the selection alone so a stray miss mid-multi-select doesn't
        // undo the work.
        if (!additive) dep.setSelectedAnchors([]);
        return;
      }
      dep.setSelectedAnchors(selectionAfterAnchorPress(dep.selectedAnchors, hit, additive));
    },
  } as ImmediateInvoker,
  enabled: (deps) => (depOf(deps) ? true : ActionDisabledReason.SelectionRequired),
};

// ---------------------------------------------------------------------------
// nudgeAnchors
// ---------------------------------------------------------------------------

type Direction = 'up' | 'down' | 'left' | 'right';
const KEY_FOR: Record<Direction, string> = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
};
const LABEL_FOR: Record<Direction, string> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
};
function delta(dir: Direction, step: number): { dx: number; dy: number } {
  switch (dir) {
    case 'up':    return { dx: 0,     dy: -step };
    case 'down':  return { dx: 0,     dy:  step };
    case 'left':  return { dx: -step, dy: 0     };
    case 'right': return { dx:  step, dy: 0     };
  }
}

/**
 * Move the selected anchors by one step. Shift multiplies the step, same
 * as node nudging.
 *
 * Every keystroke is its own history entry, matching node nudge — hold an
 * arrow down and undo walks back one step at a time rather than
 * collapsing the run.
 */
function makeNudgeAnchorsAction(dir: Direction): Action & { requires: string[] } {
  return {
    id: `nudgeAnchors.${dir}`,
    label: `Nudge Anchors ${LABEL_FOR[dir]}`,
    group: 'nudgeAnchors',
    defaultBinding: [
      { spec: { kind: 'key', key: KEY_FOR[dir] },                        opts: { params: { magnitude: 'small' } } },
      { spec: { kind: 'key', key: KEY_FOR[dir], mods: { shift: true } }, opts: { params: { magnitude: 'big' } } },
    ],
    eligible: { capability: 'edits-anchors' },
    requires: ['editAnchors'],
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const dep = depOf(deps);
        if (!dep || dep.selectedAnchors.size === 0) return;
        const step = params?.magnitude === 'big' ? BIG_STEP : SMALL_STEP;
        const { dx, dy } = delta(dir, step);
        const selected = [...dep.selectedAnchors];
        commitAnchorEdit(dep, 'Nudge anchor', (set) => {
          let any = false;
          for (const flat of selected) any = translateAnchorBy(set, flat, dx, dy) || any;
          return any;
        });
      },
    } as ImmediateInvoker,
    enabled: requiresAnchorSelection,
  };
}

export const nudgeAnchorsUpAction    = makeNudgeAnchorsAction('up');
export const nudgeAnchorsDownAction  = makeNudgeAnchorsAction('down');
export const nudgeAnchorsLeftAction  = makeNudgeAnchorsAction('left');
export const nudgeAnchorsRightAction = makeNudgeAnchorsAction('right');

// ---------------------------------------------------------------------------
// deleteAnchors
// ---------------------------------------------------------------------------

/**
 * Delete the selected anchors, refitting the surrounding curve through
 * each gap so the path keeps its shape.
 *
 * Deleting renumbers every anchor after the lowest deleted index, so the
 * selection is cleared rather than left pointing at whatever slid into
 * those slots.
 */
export const deleteAnchorsAction: Action & { requires: string[] } = {
  id: 'deleteAnchors',
  label: 'Delete Anchors',
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
      if (!dep || dep.selectedAnchors.size === 0) return;
      const doomed = [...dep.selectedAnchors];
      const changed = commitAnchorEdit(dep, 'Delete anchor', (set) =>
        deleteAnchorsAt(set, doomed),
      );
      if (changed) dep.setSelectedAnchors([]);
    },
  } as ImmediateInvoker,
  enabled: requiresAnchorSelection,
};

// ---------------------------------------------------------------------------
// cutPathAtAnchor (scissors)
// ---------------------------------------------------------------------------

/**
 * Open a closed subpath at the alt+shift-clicked anchor — the scissors
 * operation the pen tool used to own.
 *
 * Bound to Alt+Shift+click rather than plain Alt+click so it doesn't
 * collide with `insertPathAnchorAction`, which is already Alt+click on
 * the same path. Both are "alt-click surgery on the edited path"; the
 * extra modifier picks which one, instead of the two actions racing on an
 * identical binding where only one could ever win.
 *
 * No-ops on an open subpath: there's nothing to cut.
 */
export const cutPathAtAnchorAction: Action & { requires: string[] } = {
  id: 'cutPathAtAnchor',
  label: 'Cut path at anchor',
  defaultBinding: { kind: 'click', mods: { alt: true, shift: true } },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
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

      // Find the anchor under the click. Clicks carry no affordance (only
      // pointerdown does), so this resolves the hit itself — the same
      // approach insertPathAnchorAction takes for segments.
      const nearest = nearestAnchorIndex(worldPath, wx, wy, ANCHOR_CLICK_SLOP);
      if (nearest === -1) return;

      const changed = commitAnchorEdit(dep, 'Cut path', (set) => openSubpathAt(set, nearest));
      // Cutting rotates the subpath's anchor order, so held indices are stale.
      if (changed) dep.setSelectedAnchors([]);
    },
  } as ImmediateInvoker,
  enabled: (deps) => (depOf(deps) ? true : ActionDisabledReason.SelectionRequired),
};

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

// ---------------------------------------------------------------------------
// marqueeAnchors
// ---------------------------------------------------------------------------

/**
 * Rubber-band select anchors by dragging on empty canvas while a path is
 * in edit mode.
 *
 * Shift adds to the existing anchor selection instead of replacing it.
 * The in-flight rect goes on the `editAnchors` dep so the path-editing
 * overlay can draw it — same "ongoing action owns the state, chrome
 * draws it" split the move ghosts and the node marquee use.
 */
export const marqueeAnchorsAction: Action & { requires: string[] } = {
  id: 'marqueeAnchors',
  label: 'Marquee-select anchors',
  defaultBinding: { kind: 'drag', target: 'empty' },
  eligible: { capability: 'edits-anchors' },
  requires: ['editAnchors'],
  invoker: {
    timing: 'ongoing',
    start(ctx: InvocationCtx): OngoingHandle {
      const dep = depOf(ctx.deps);
      // Not editing → decline so the dispatcher falls through to the
      // node-level areaSelect. This is what keeps non-modal consumers
      // (no eligibility filtering) behaving normally.
      if (!dep) return {};
      const worldPath = worldPathOf(dep);
      if (!worldPath) return {};

      const additive = ctx.modifiers.shift;
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
  enabled: () => true,
};

// ---------------------------------------------------------------------------
// Local geometry helper
// ---------------------------------------------------------------------------

/** Flat indices of `path`'s anchors inside `rect`. */
function anchorsOfPathInRect(
  path: PolygonPath,
  rect: { x: number; y: number; width: number; height: number },
): number[] {
  return anchorsInRect(pathToAnchors(path) as AnchorSet, rect);
}
