import { describe, it, expect } from 'vitest';
import {
  ActionsProvider, useActionsRegistry, useAction,
} from '../index';
import type {
  Action, ActionEntry, ActionsProp, ActionsRegistry,
} from '../index';

void (undefined as Action | ActionEntry | ActionsProp | ActionsRegistry | undefined);

describe('Actions Registry public barrel', () => {
  it('exports the documented runtime symbols', () => {
    expect(ActionsProvider).toBeTypeOf('function');
    expect(useActionsRegistry).toBeTypeOf('function');
    expect(useAction).toBeTypeOf('function');
  });
});
