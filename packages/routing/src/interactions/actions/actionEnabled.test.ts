import { describe, expect, it } from 'vitest';
import { evaluateEnabled } from './actionEnabled';
import { ActionDisabledReason, type Action } from './action';

describe('evaluateEnabled with a point', () => {
  it('passes the point to the predicate', () => {
    const action: Action = {
      id: 'here',
      label: 'Here',
      enabled: (_deps, at) => (at && at.x > 0 ? true : ActionDisabledReason.NotApplicable),
    };
    expect(evaluateEnabled(action, undefined, { x: 5, y: 0 }).enabled).toBe(true);
    expect(evaluateEnabled(action, undefined, { x: -5, y: 0 }).enabled).toBe(false);
    expect(evaluateEnabled(action).enabled).toBe(false);
  });
});

describe('evaluateEnabled with a reason written as text', () => {
  it('surfaces the text as the reason', () => {
    const action: Action = {
      id: 'full',
      label: 'Full',
      enabled: () => 'At most 8 at once',
    };
    expect(evaluateEnabled(action)).toEqual({ enabled: false, reason: 'At most 8 at once' });
  });
});
