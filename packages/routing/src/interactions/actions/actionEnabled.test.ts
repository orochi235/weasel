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
