import { describe, it, expect } from 'vitest';
import {
  ActionsProvider, useActionsRegistry, useAction,
  defaultSelectAllAction, defaultEscapeAction, defaultDuplicateAction,
  defaultNudgeActions, defaultReorderActions,
} from '../index';
import type {
  Action, ActionEntry, ActionsProp, ActionsRegistry,
} from '../index';
// XDeps interfaces (SelectAllDeps, EscapeDeps, etc.) are no longer public API
// (removed from barrel in Phase 4 Task 8). Access them directly from their
// defaults modules if needed for consumer-side type assertions.
import type { SelectAllDeps, EscapeDeps, DuplicateDeps, NudgeDeps, ReorderDeps } from '../interactions/actions/defaults';

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
