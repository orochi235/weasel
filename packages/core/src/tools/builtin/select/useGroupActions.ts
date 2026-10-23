import { useCallback, useMemo, type RefObject } from 'react';
import type { Action } from '@weasel-js/routing';
import { poseDescriptorForNode, visualBoundsViaDescriptor, type PoseDescriptor } from 'core/geometry/poseDescriptor';
import { createSelectDeepAction } from '../../../interactions/actions/defaults/selectDeep';
import { createEnterGroupAction, createLeaveGroupAction } from '../../../interactions/actions/defaults/enterGroup';
import type { Bounds } from '../shared/selectionTarget';
import { onBody, onEmptyCanvas } from './selectionContributions';

interface GroupTree {
  getParent(id: string): string | null;
  getNode(id: string): unknown;
  getPose(id: string): unknown;
}

/** The select tool's actions that work with groups: `select.deep`, `group.enter` and `group.leave`. */
export function useGroupActions<TPose>(args: {
  adapterRef: RefObject<GroupTree>;
  descriptor: PoseDescriptor<TPose>;
  pickHit: (worldX: number, worldY: number, alt: boolean, selection: readonly string[]) => string | null;
  boxOf: ((id: string) => Bounds | null) | undefined;
  extendLocked: () => boolean;
  settled: () => void;
}): { deepAction: Action; enterAction: Action; leaveAction: Action } {
  const { adapterRef, descriptor, pickHit, extendLocked, settled } = args;
  const boxOfOption = args.boxOf;
  const poseBox = useCallback((id: string) => {
    const a = adapterRef.current;
    const node = a.getNode(id);
    const pose = a.getPose(id) as TPose | undefined;
    if (!node || !pose) return null;
    return visualBoundsViaDescriptor(pose, poseDescriptorForNode(descriptor, node));
  }, [adapterRef, descriptor]);
  const boxOf = boxOfOption ?? poseBox;

  const deepAction = useMemo(
    () => createSelectDeepAction({ pickHit, extendLocked, settled }),
    [pickHit, extendLocked, settled],
  );

  const enterAction = useMemo(() => createEnterGroupAction({
    pickHit: (x, y) => pickHit(x, y, false, []),
    tree: { getParent: (id) => adapterRef.current.getParent(id), getNode: (id) => adapterRef.current.getNode(id) },
  }), [pickHit, adapterRef]);

  const leaveAction = useMemo(() => createLeaveGroupAction({ boxOf }), [boxOf]);

  return { deepAction, enterAction, leaveAction };
}

/**
 * A double-click on a body enters the group a press there would select; the action declines
 * where that is no group, so text and path editing keep their double-click. Escape leaves the
 * entered group, carrying the phase `escape` does and declining with nothing entered, which
 * leaves Escape to `escape`. A press outside the group's box leaves it: nodes outside the entered
 * group take no hits, so every such press lands on empty canvas.
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
