import { describe, expect, it } from 'vitest';
import { controlAccess, nestHold, NO_HOLD } from './hold';

describe('nestHold', () => {
  it('holds everything inside a level that is on', () => {
    expect(nestHold(NO_HOLD, true)).toEqual({ on: true });
    expect(nestHold(nestHold(NO_HOLD, true), undefined)).toEqual({ on: true });
  });

  it('cannot lift an outer hold from inside', () => {
    expect(nestHold(nestHold(NO_HOLD, true, 'Locked'), false)).toEqual({ on: true, reason: 'Locked' });
  });

  it('takes the nearest reason among the levels that are on', () => {
    const locked = nestHold(NO_HOLD, true, 'Locked');
    expect(nestHold(locked, true, 'Nothing selected')).toEqual({ on: true, reason: 'Nothing selected' });
    expect(nestHold(locked, true)).toEqual({ on: true, reason: 'Locked' });
    expect(nestHold(locked, false, 'Nothing selected')).toEqual({ on: true, reason: 'Locked' });
  });

  it('ignores the reason of a level that is off', () => {
    expect(nestHold(NO_HOLD, false, 'Locked')).toBe(NO_HOLD);
  });
});

describe('controlAccess', () => {
  it('leaves a disabled control with no reason unreachable', () => {
    expect(controlAccess({ on: true })).toEqual({ state: 'disabled', reachable: false, reason: undefined });
  });

  it('keeps a disabled control with a reason reachable', () => {
    expect(controlAccess({ on: true, reason: 'Locked' })).toEqual({ state: 'disabled', reachable: true, reason: 'Locked' });
  });

  it('lets disabled beat read-only', () => {
    expect(controlAccess({ on: true }, { on: true, reason: 'Shared' }).state).toBe('disabled');
    expect(controlAccess(NO_HOLD, { on: true, reason: 'Shared' })).toEqual({ state: 'readOnly', reachable: true, reason: 'Shared' });
    expect(controlAccess(NO_HOLD).state).toBe('enabled');
  });
});
