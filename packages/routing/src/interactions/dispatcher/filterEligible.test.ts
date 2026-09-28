import { describe, it, expect } from 'vitest';
import { filterEligible } from './dispatcher';
import type { Action } from '../actions/action';
import type { RuleCtx } from '../../eligibility';

function makeRuleCtx(overrides: Partial<RuleCtx> = {}): RuleCtx {
  return {
    focused: true,
    selection: [],
    multiActive: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: { kind: null, id: null },
    hover: null,
    zoom: 1,
    mode: 'normal',
    allowedCapabilities: new Set(),
    ...overrides,
  };
}

function makeAction(id: string, eligible?: Action['eligible']): Action {
  return {
    id,
    label: id,
    ...(eligible !== undefined ? { eligible } : {}),
  };
}

describe('filterEligible', () => {
  it('keeps candidates whose action has no `eligible`', () => {
    const a = makeAction('a');
    const matches = [{ binding: { actionId: 'a' } }];
    const lookup = (id: string) => (id === 'a' ? a : undefined);
    const out = filterEligible(matches, lookup, makeRuleCtx({ mode: 'normal' }));
    expect(out).toHaveLength(1);
  });

  it('drops candidates whose action `eligible` rule fails', () => {
    const a = makeAction('a', { mode: 'path-edit' });
    const matches = [{ binding: { actionId: 'a' } }];
    const lookup = (id: string) => (id === 'a' ? a : undefined);
    const out = filterEligible(matches, lookup, makeRuleCtx({ mode: 'normal' }));
    expect(out).toHaveLength(0);
  });

  it('keeps candidates whose unknown action lookup returns undefined', () => {
    // Unknown action — the "no-such-action" trace path handles it downstream.
    const matches = [{ binding: { actionId: 'unknown' } }];
    const out = filterEligible(matches, () => undefined, makeRuleCtx());
    expect(out).toHaveLength(1);
  });
});
