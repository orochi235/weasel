import { rectContainsPoint, type Rect } from '@weasel-js/geom';
import type { Action, ActionDeps, WorldPoint } from '@weasel-js/routing';
import { ActionDisabledReason, defineAction } from '@weasel-js/routing';
import { isEnterable, type NodeId } from '@weasel-js/core';
import { pressTarget, type EnteredGroupApi, type PressTargetTree } from '@weasel-js/core/engine';
import type {} from '@weasel-js/core';

/** What `group.enter` reads: the node under a point and the tree above it. */
export interface EnterGroupOptions {
  /** The node under the point, before any group above it is considered, as the
   *  view `viewId` names sees it: `null` or absent for the surface. */
  pickHit: (world: WorldPoint, viewId?: string | null) => string | null;
  tree: PressTargetTree;
}

/** What `group.leave` reads: where a group's box is. */
export interface LeaveGroupOptions {
  boxOf: (id: string) => Rect | null;
}

/**
 * Leaves every entered group whose box does not hold `p`, innermost first. A press that lands
 * inside the entered group's box stays in it, and so does one on a group with no box to read.
 */
export function leaveGroupsOutside(
  entered: EnteredGroupApi,
  boxOf: LeaveGroupOptions['boxOf'],
  p: WorldPoint,
): void {
  for (let id = entered.get(); id !== null; id = entered.get()) {
    const box = boxOf(id);
    if (box === null || rectContainsPoint(box, p.x, p.y)) return;
    entered.leave();
    if (entered.get() === id) return;
  }
}

/**
 * `group.enter` — enters the group a press at the point would select. Bound to a double-click
 * on a body by `useSelectTool`. It declines where that is not a group, so the double-click
 * falls through to text editing, path editing and the mode triggers.
 */
export function createEnterGroupAction(opts: EnterGroupOptions): Action {
  const targetAt = (deps: ActionDeps | undefined, p: WorldPoint | undefined, viewId: string | null | undefined): string | null => {
    const entered = deps?.enteredGroup;
    if (!entered || !p) return null;
    const hit = viewId == null ? opts.pickHit(p) : opts.pickHit(p, viewId);
    if (hit === null) return null;
    const target = pressTarget(opts.tree, hit, entered.get());
    return isEnterable(opts.tree.getNode(target) as Parameters<typeof isEnterable>[0]) ? target : null;
  };
  return defineAction({
    id: 'group.enter',
    label: 'Enter group',
    eligible: { capability: 'creates-selection' },
    requires: ['enteredGroup'],
    enabled: (deps, at, _carried, _params, viewId) =>
      (targetAt(deps, at, viewId) !== null ? true : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate',
      run: (deps, p) => {
        const target = p?.world ? targetAt(deps, p.world, p.viewId) : null;
        if (target !== null) deps.enteredGroup?.enter(target as NodeId);
      },
    },
  });
}

/**
 * `group.leave` — Escape leaves the entered group for the one above it; a press outside the
 * entered group's box leaves every group that box does not hold. With nothing entered it
 * declines, so Escape clears the selection as before, and it declines while path anchors are
 * being edited, so that Escape exits the edit first.
 */
export function createLeaveGroupAction(opts: LeaveGroupOptions): Action {
  return defineAction({
    id: 'group.leave',
    label: 'Leave group',
    eligible: { capability: 'creates-selection' },
    requires: ['enteredGroup', 'editAnchors'],
    enabled: (deps, at) => {
      const here = deps?.enteredGroup?.get() ?? null;
      if (here === null || deps?.editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
      if (!at) return true;
      const box = opts.boxOf(here);
      return box !== null && !rectContainsPoint(box, at.x, at.y) ? true : ActionDisabledReason.NotApplicable;
    },
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const entered = deps.enteredGroup;
        if (!entered) return;
        const world = params?.world;
        if (world) leaveGroupsOutside(entered, opts.boxOf, world);
        else entered.leave();
      },
    },
  });
}
