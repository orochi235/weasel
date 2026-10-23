import { useCallback, useMemo, type RefObject } from 'react';
import type { Action } from '@weasel-js/routing';
import { poseDescriptorForNode, visualBoundsViaDescriptor, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { createSelectDeepAction } from '../../../interactions/actions/defaults/selectDeep';
import {
  createEnterGroupAction, createLeaveGroupAction, leaveGroupsOutside,
} from '../../../interactions/actions/defaults/enterGroup';
import { onBody, onEmptyCanvas } from './selectionContributions';

interface GroupTree {
  getParent(id: string): string | null;
  getNode(id: string): unknown;
  getPose(id: string): unknown;
}

/**
 * The select tool's actions that work with groups: `select.deep`, `group.enter` and
 * `group.leave`, and `boxOf`, where a group's box is, which `select.pick` leaves groups by.
 */
export function useGroupActions<TPose>(args: {
  adapterRef: RefObject<GroupTree>;
  descriptor: PoseDescriptor<TPose>;
  pickHit: (worldX: number, worldY: number, alt: boolean, selection: readonly string[]) => string | null;
  extendLocked: () => boolean;
  settled: () => void;
}): { boxOf: (id: string) => ReturnType<typeof visualBoundsViaDescriptor> | null; deepAction: Action; enterAction: Action; leaveAction: Action } {
  const { adapterRef, descriptor, pickHit, extendLocked, settled } = args;
  const boxOf = useCallback((id: string) => {
    const a = adapterRef.current;
    const node = a.getNode(id);
    const pose = a.getPose(id) as TPose | undefined;
    if (!node || !pose) return null;
    return visualBoundsViaDescriptor(pose, poseDescriptorForNode(descriptor, node));
  }, [adapterRef, descriptor]);

  const deepAction = useMemo(() => createSelectDeepAction({
    pickHit,
    extendLocked,
    leaveOutside: (entered, x, y) => leaveGroupsOutside(entered, boxOf, { x, y }),
    settled,
  }), [pickHit, extendLocked, boxOf, settled]);

  const enterAction = useMemo(() => createEnterGroupAction({
    pickHit: (x, y) => pickHit(x, y, false, []),
    tree: { getParent: (id) => adapterRef.current.getParent(id), getNode: (id) => adapterRef.current.getNode(id) },
  }), [pickHit, adapterRef]);

  const leaveAction = useMemo(() => createLeaveGroupAction({ boxOf }), [boxOf]);

  return { boxOf, deepAction, enterAction, leaveAction };
}

/**
 * A double-click on a body enters the group a press there would select; the action declines
 * where that is no group, so text and path editing keep their double-click. Escape leaves the
 * entered group, carrying the phase `escape` does and declining with nothing entered, which
 * leaves Escape to `escape`. A press outside the group's box leaves it, on empty canvas only:
 * a press on a body leaves inside `select.pick`, which has to see the group it is leaving.
 */
export const GROUP_BINDINGS = [
  {
    spec: { kind: 'doubleClick' as const, target: { kindOf: onBody } },
    actionId: 'group.enter',
    opts: { id: 'group.enter' },
  },
  {
    spec: { kind: 'key' as const, key: 'Escape', phase: [{ channel: '*', phase: 'initial' as const }] },
    actionId: 'group.leave',
    opts: { id: 'group.leave.key' },
  },
  {
    spec: { kind: 'pointerDown' as const, target: { kindOf: onEmptyCanvas } },
    actionId: 'group.leave',
    opts: { id: 'group.leave.press' },
  },
];
