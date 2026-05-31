/**
 * Dispatcher eligibility-filter tests — exercises the `Action.eligible`
 * gate added in mode-aware-dispatch Task 10. The dispatcher receives a
 * `getRuleCtx` thunk in `DispatcherContext`; when supplied, candidates
 * whose `eligible` rule evaluates false against the live RuleCtx are
 * stripped before the start-try loop.
 */

import { describe, it, expect, vi } from 'vitest';
import { createDispatcher, filterEligible } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry, Action } from '../actions/registry';
import type { DepRegistry } from '../actions/depRegistry';
import type { InputEvent } from './matcher';
import type { RuleCtx } from '../../features/chrome-caps';

function makeRegistry(actions: Action[]): ActionsRegistry {
  const map = new Map(actions.map((a) => [a.id, a]));
  return {
    register: vi.fn().mockReturnValue(() => {}),
    unregister: vi.fn(),
    list: () => Array.from(map.values()),
    trigger: vi.fn().mockReturnValue(false),
    subscribe: vi.fn().mockReturnValue(() => {}),
    begin: vi.fn().mockReturnValue(null),
    setDispatcher: vi.fn(),
  };
}

function makeDepRegistry(): DepRegistry {
  return {
    register: vi.fn().mockReturnValue(() => {}),
    get: vi.fn() as DepRegistry['get'],
  };
}

function makeRuleCtx(overrides: Partial<RuleCtx> = {}): RuleCtx {
  return {
    focused: true,
    selection: [],
    multiActive: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: { kind: null, id: null },
    hover: null,
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    mode: 'normal',
    allowedCapabilities: new Set(),
    ...overrides,
  };
}

function makeCtx(
  overrides: Partial<DispatcherContext> & { actions: ActionsRegistry },
): DispatcherContext {
  return {
    depRegistry: makeDepRegistry(),
    activeToolId: 'select',
    hotkeyStack: [],
    toolsById: new Map(),
    isMac: false,
    ...overrides,
  };
}

function ongoingAction(
  id: string,
  start: ReturnType<typeof vi.fn>,
  eligible?: Action['eligible'],
): Action {
  return {
    id,
    label: id,
    defaultBinding: { kind: 'drag' },
    invoker: { timing: 'ongoing', start: start as never },
    ...(eligible !== undefined ? { eligible } : {}),
  };
}

const dragEvent: InputEvent = {
  kind: 'pointerdown',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

describe('dispatcher: action eligibility filter', () => {
  it('skips an action whose `eligible` rule fails for the active mode', () => {
    // Single binding bound to a path-edit-only action; active mode is
    // 'normal' — the dispatcher must NOT call start().
    const start = vi.fn().mockReturnValue({ onMove: vi.fn(), onEnd: vi.fn() });
    const action = ongoingAction('only-path-edit', start, { mode: 'path-edit' });
    const registry = makeRegistry([action]);
    const dispatcher = createDispatcher();

    const result = dispatcher.handleInput(
      dragEvent,
      makeCtx({
        actions: registry,
        getRuleCtx: () => makeRuleCtx({ mode: 'normal' }),
      }),
    );
    expect(start).not.toHaveBeenCalled();
    expect(result).toBe('unhandled');
  });

  it('lets through an action whose `eligible` rule passes', () => {
    const start = vi.fn().mockReturnValue({ onMove: vi.fn(), onEnd: vi.fn() });
    const action = ongoingAction('only-path-edit', start, { mode: 'path-edit' });
    const registry = makeRegistry([action]);
    const dispatcher = createDispatcher();

    const result = dispatcher.handleInput(
      dragEvent,
      makeCtx({
        actions: registry,
        getRuleCtx: () => makeRuleCtx({ mode: 'path-edit' }),
      }),
    );
    expect(start).toHaveBeenCalledOnce();
    expect(result).toBe('handled');
  });

  it('treats actions without `eligible` as always eligible', () => {
    const start = vi.fn().mockReturnValue({ onMove: vi.fn(), onEnd: vi.fn() });
    const action = ongoingAction('plain', start);
    const registry = makeRegistry([action]);
    const dispatcher = createDispatcher();

    const result = dispatcher.handleInput(
      dragEvent,
      makeCtx({
        actions: registry,
        getRuleCtx: () => makeRuleCtx({ mode: 'normal' }),
      }),
    );
    expect(start).toHaveBeenCalledOnce();
    expect(result).toBe('handled');
  });

  it('without getRuleCtx, no filtering is applied (back-compat)', () => {
    // An action declares it's path-edit-only, but no RuleCtx thunk is
    // wired — legacy harnesses keep working unchanged.
    const start = vi.fn().mockReturnValue({ onMove: vi.fn(), onEnd: vi.fn() });
    const action = ongoingAction('only-path-edit', start, { mode: 'path-edit' });
    const registry = makeRegistry([action]);
    const dispatcher = createDispatcher();

    const result = dispatcher.handleInput(dragEvent, makeCtx({ actions: registry }));
    expect(start).toHaveBeenCalledOnce();
    expect(result).toBe('handled');
  });
});

describe('filterEligible (helper)', () => {
  function makeAction(id: string, eligible?: Action['eligible']): Action {
    return {
      id,
      label: id,
      ...(eligible !== undefined ? { eligible } : {}),
    };
  }

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
    // Unknown action — let the existing "no-such-action" trace path
    // handle it downstream; the eligibility filter is not the place to
    // strip these.
    const matches = [{ binding: { actionId: 'unknown' } }];
    const out = filterEligible(matches, () => undefined, makeRuleCtx());
    expect(out).toHaveLength(1);
  });
});
