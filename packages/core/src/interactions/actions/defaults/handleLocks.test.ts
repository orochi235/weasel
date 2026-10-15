import { describe, expect, it } from 'vitest';
import type { ActionDeps, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { makeEditAnchorsDep } from '../testUtils';
import { handleLockAngleAction, handleLockLengthAction } from './handleLocks';

const run = (action: { invoker?: unknown }, deps: ActionDeps) =>
  (action.invoker as ImmediateInvoker).run(deps, {});

function setup() {
  const dep = makeEditAnchorsDep();
  return { dep, deps: { editAnchors: dep } as unknown as ActionDeps };
}

describe('handle lock toggles', () => {
  it('names the actions in the anchors group, with icons and no default binding', () => {
    for (const action of [handleLockAngleAction, handleLockLengthAction]) {
      expect(action.group).toBe('anchors');
      expect(action.icon).toBeDefined();
      expect(action.defaultBinding).toBeUndefined();
    }
    expect(handleLockAngleAction.id).toBe('handleLock.angle');
    expect(handleLockLengthAction.id).toBe('handleLock.length');
  });

  it('sets the lock on the editAnchors dep, and reads pressed while it is on', () => {
    const { dep, deps } = setup();
    expect(handleLockAngleAction.active!(deps)).toBe(false);
    run(handleLockAngleAction, deps);
    expect(dep.handleLocks).toEqual({ angle: true, length: false });
    expect(handleLockAngleAction.active!(deps)).toBe(true);
    expect(handleLockLengthAction.active!(deps)).toBe(false);
    run(handleLockLengthAction, deps);
    expect(dep.handleLocks).toEqual({ angle: true, length: true });
    run(handleLockAngleAction, deps);
    expect(dep.handleLocks).toEqual({ angle: false, length: true });
  });

  it('is unavailable without a dep that holds locks', () => {
    const dep = makeEditAnchorsDep({ setHandleLocks: undefined });
    const deps = { editAnchors: dep } as unknown as ActionDeps;
    expect(handleLockAngleAction.enabled!(deps)).toBe(ActionDisabledReason.NotApplicable);
    expect(handleLockLengthAction.enabled!(undefined)).toBe(ActionDisabledReason.NotApplicable);
  });
});
