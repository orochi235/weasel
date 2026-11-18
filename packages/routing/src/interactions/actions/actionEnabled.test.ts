import { describe, expect, it, vi } from 'vitest';
import { checkActive, checkEnabled } from './actionEnabled';
import { ActionDisabledReason, type Action } from './action';

describe('checkEnabled with a point', () => {
  it('passes the point to the predicate', () => {
    const action: Action = {
      id: 'here',
      label: 'Here',
      enabled: (_deps, at) => (at && at.x > 0 ? true : ActionDisabledReason.NotApplicable),
    };
    expect(checkEnabled(action, undefined, { x: 5, y: 0 }).enabled).toBe(true);
    expect(checkEnabled(action, undefined, { x: -5, y: 0 }).enabled).toBe(false);
    expect(checkEnabled(action).enabled).toBe(false);
  });
});

describe('checkEnabled with a reason written as text', () => {
  it('surfaces the text as the reason', () => {
    const action: Action = {
      id: 'full',
      label: 'Full',
      enabled: () => 'At most 8 at once',
    };
    expect(checkEnabled(action)).toEqual({ enabled: false, reason: 'At most 8 at once' });
  });
});

describe('a predicate that throws', () => {
  it('warns once per action for active, as for enabled, under the same contract', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const action: Action = {
      id: 'broken-both',
      label: 'Broken',
      enabled: () => { throw new Error('enabled broke'); },
      active: () => { throw new Error('active broke'); },
    };
    expect(checkEnabled(action).reason).toBe(ActionDisabledReason.PredicateThrew);
    expect(checkEnabled(action).enabled).toBe(false);
    expect(checkActive(action)).toBe(false);
    expect(checkActive(action)).toBe(false);
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenLastCalledWith(expect.stringContaining('active() for action "broken-both" threw'), expect.any(Error));
    warn.mockRestore();
  });
});
