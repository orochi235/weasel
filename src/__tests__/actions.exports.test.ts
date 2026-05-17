import { describe, it, expect } from 'vitest';
import {
  ActionsProvider, useActionsRegistry, useAction,
} from '../index';
import type {
  Action, ActionEntry, ActionsProp, ActionsRegistry,
} from '../index';

describe('Actions Registry public barrel', () => {
  it('exports the documented runtime symbols', () => {
    expect(ActionsProvider).toBeTypeOf('function');
    expect(useActionsRegistry).toBeTypeOf('function');
    expect(useAction).toBeTypeOf('function');
  });
  it('type imports compile (compile-time assertion)', () => {
    const _check: Action | ActionEntry | ActionsProp | ActionsRegistry | undefined = undefined;
    expect(_check).toBeUndefined();
  });
});
