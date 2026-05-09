import { describe, it, expect } from 'vitest';
import {
  ActionsProvider, useActionsRegistry, useAction,
  defaultSelectAllAction, defaultEscapeAction, defaultDuplicateAction,
  defaultNudgeActions, defaultReorderActions,
} from '../index';
import type {
  Action, ActionEntry, ActionsProp, ActionsRegistry,
  SelectAllDeps, EscapeDeps, DuplicateDeps, NudgeDeps, ReorderDeps,
} from '../index';

describe('Actions Registry public barrel', () => {
  it('exports the documented runtime symbols', () => {
    expect(ActionsProvider).toBeTypeOf('function');
    expect(useActionsRegistry).toBeTypeOf('function');
    expect(useAction).toBeTypeOf('function');
    expect(defaultSelectAllAction).toBeTypeOf('function');
    expect(defaultEscapeAction).toBeTypeOf('function');
    expect(defaultDuplicateAction).toBeTypeOf('function');
    expect(defaultNudgeActions).toBeTypeOf('function');
    expect(defaultReorderActions).toBeTypeOf('function');
  });
  it('type imports compile (compile-time assertion)', () => {
    const _check: Action | ActionEntry | ActionsProp | ActionsRegistry |
      SelectAllDeps | EscapeDeps | DuplicateDeps | NudgeDeps<unknown> | ReorderDeps |
      undefined = undefined;
    expect(_check).toBeUndefined();
  });
});
