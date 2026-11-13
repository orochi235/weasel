import { ANY_MODS } from '@weasel-js/gestures';
import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import {
  createEnterGroupAction, createLeaveGroupAction, type EnterGroupOptions, type LeaveGroupOptions,
} from '../../../interactions/actions/defaults/enterGroup';
import type { Contribution } from '../../overlayBinding';
import { onBody, onEmptyCanvas } from './selectionContributions';
import { BETWEEN_GESTURES } from '@weasel-js/routing';

/** Id of the entry {@link createGroupEntryContribution} builds. */
export const GROUP_ENTRY_ID = 'group.entry';

/**
 * `group.enter` and `group.leave`, bound under any tool that leaves the gesture unclaimed. A
 * double-click on a body enters the group a press there would select, and declines where that is
 * no group, so text and path editing keep their double-click. Escape leaves one level, carrying
 * the phase `escape` does and declining with nothing entered, which leaves Escape to `escape`.
 * Leaving on a press is the select tool's ({@link GROUP_LEAVE_PRESS_BINDING}): under a drawing
 * tool a press outside the group draws into it.
 */
export function createGroupEntryContribution(opts: EnterGroupOptions & LeaveGroupOptions): Contribution {
  return {
    id: GROUP_ENTRY_ID,
    eligibility: { always: true },
    actions: [createEnterGroupAction(opts), createLeaveGroupAction(opts)],
    bindings: [
      {
        spec: { kind: 'doubleClick', target: { kindOf: onBody }, phase: BETWEEN_GESTURES },
        actionId: 'group.enter',
        opts: { id: 'group.enter' },
      },
      {
        spec: { kind: 'key', key: 'Escape', phase: BETWEEN_GESTURES },
        actionId: 'group.leave',
        opts: { id: 'group.leave.key', yields: true },
      },
    ],
  };
}

/** {@link createGroupEntryContribution} for the life of a canvas, reading its pickers live. */
export function useGroupEntryContribution(opts: EnterGroupOptions & LeaveGroupOptions): Contribution {
  const live = useLatest(opts);
  return useMemo(() => createGroupEntryContribution({
    pickHit: (world, viewId) => (viewId == null ? live.current.pickHit(world) : live.current.pickHit(world, viewId)),
    tree: {
      getParent: (id) => live.current.tree.getParent(id),
      getNode: (id) => live.current.tree.getNode(id),
    },
    boxOf: (id) => live.current.boxOf(id),
  }), [live]);
}

/**
 * A press outside the entered group's box leaves it, whatever modifiers are held. Nodes outside
 * the group take no hits, so every such press lands on empty canvas.
 */
export const GROUP_LEAVE_PRESS_BINDING = {
  spec: { kind: 'pointerDown' as const, target: { kindOf: onEmptyCanvas }, mods: ANY_MODS },
  actionId: 'group.leave',
  opts: { id: 'group.leave.press' },
};
