import type { Action, ActionDeps, WorldPoint } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { EnteredGroupApi } from 'canvas/deps/enteredGroup';
import type { NodeId } from 'core/scene/types';
import { pressTarget, type PressTargetTree } from '../../../tools/builtin/pressTarget';

type Box = { x: number; y: number; width: number; height: number };

/** What `group.enter` reads: the node under a point and the tree above it. */
export interface EnterGroupOptions {
  /** The node under the point, before any group above it is considered. */
  pickHit: (worldX: number, worldY: number) => string | null;
  tree: PressTargetTree;
}

/** What `group.leave` reads: where a group's box is. */
export interface LeaveGroupOptions {
  boxOf: (id: string) => Box | null;
}

const inside = (b: Box, p: WorldPoint) =>
  p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;

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
    if (box === null || inside(box, p)) return;
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
  const targetAt = (deps: ActionDeps | undefined, p: WorldPoint | undefined): string | null => {
    const entered = deps?.enteredGroup;
    if (!entered || !p) return null;
    const hit = opts.pickHit(p.x, p.y);
    if (hit === null) return null;
    const target = pressTarget(opts.tree, hit, entered.get());
    return (opts.tree.getNode(target) as { kind?: string } | undefined)?.kind === 'group' ? target : null;
  };
  return {
    id: 'group.enter',
    label: 'Enter group',
    eligible: { capability: 'creates-selection' },
    requires: ['enteredGroup'],
    enabled: (deps, at) => (targetAt(deps, at) !== null ? true : ActionDisabledReason.NotApplicable),
    invoker: {
      timing: 'immediate' as const,
      run: (deps, params) => {
        const x = params?.worldX, y = params?.worldY;
        const target = typeof x === 'number' && typeof y === 'number' ? targetAt(deps, { x, y }) : null;
        if (target !== null) deps.enteredGroup?.enter(target as NodeId);
      },
    },
  };
}

/**
 * `group.leave` — Escape leaves the entered group for the one above it; a press outside the
 * entered group's box leaves every group that box does not hold. With nothing entered it
 * declines, so Escape clears the selection as before, and it declines while path anchors are
 * being edited, so that Escape exits the edit first.
 */
export function createLeaveGroupAction(opts: LeaveGroupOptions): Action {
  return {
    id: 'group.leave',
    label: 'Leave group',
    eligible: { capability: 'creates-selection' },
    requires: ['enteredGroup', 'editAnchors'],
    enabled: (deps, at) => {
      const here = deps?.enteredGroup?.get() ?? null;
      if (here === null || deps?.editAnchors?.editingId) return ActionDisabledReason.NotApplicable;
      if (!at) return true;
      const box = opts.boxOf(here);
      return box !== null && !inside(box, at) ? true : ActionDisabledReason.NotApplicable;
    },
    invoker: {
      timing: 'immediate' as const,
      run: (deps, params) => {
        const entered = deps.enteredGroup;
        if (!entered) return;
        const x = params?.worldX, y = params?.worldY;
        if (typeof x === 'number' && typeof y === 'number') leaveGroupsOutside(entered, opts.boxOf, { x, y });
        else entered.leave();
      },
    },
  };
}
