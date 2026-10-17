/**
 * Toggles for the locks every path-edit handle drag holds without a
 * modifier: its angle, its length, or both, which freezes it. They set the
 * `editAnchors` dep's `handleLocks`, so a bar, the command palette, and
 * `<SceneCanvas tune>`'s `handleLock` param, which they start from, all
 * reach the one value the drag reads.
 */

import { type Action, type ActionDeps, ActionDisabledReason, type ImmediateInvoker } from '@weasel-js/routing';
import { type HandleLock, pathOperationTags } from '@weasel-js/core';
import { icon } from '../icons.gen';

function makeHandleLockToggle(
  lock: HandleLock,
  label: string,
  icon: Action['icon'],
): Action & { requires: string[] } {
  return {
    id: `handleLock.${lock}`,
    label,
    tags: pathOperationTags('drag'),
    icon,
    group: 'anchors',
    requires: ['editAnchors'],
    active: (deps?: ActionDeps) => deps?.editAnchors?.handleLocks?.[lock] === true,
    enabled: (deps?: ActionDeps) =>
      deps?.editAnchors?.setHandleLocks ? true : ActionDisabledReason.NotApplicable,
    invoker: {
      timing: 'immediate',
      run: (deps) => {
        const dep = deps?.editAnchors;
        if (!dep?.setHandleLocks) return;
        const held = dep.handleLocks ?? { angle: false, length: false };
        dep.setHandleLocks({ ...held, [lock]: !held[lock] });
      },
    } as ImmediateInvoker,
  };
}

/** Hold every handle drag to the handle's angle, as Shift does. */
export const handleLockAngleAction = makeHandleLockToggle('angle', 'Hold handle angle', icon('core:holdHandleAngle'));

/** Hold every handle drag to the handle's length, as Mod (Cmd or Ctrl) does. */
export const handleLockLengthAction = makeHandleLockToggle('length', 'Hold handle length', icon('core:holdHandleLength'));
