/** `Action.enabled` is told what a drop or a paste carries, in prediction and in dispatch. */
import { describe, expect, it, vi } from 'vitest';
import { createDispatcher } from './dispatcher';
import type { DispatcherContext } from './dispatcher';
import type { ActionsRegistry } from '../actions/registry';
import type { Action } from '../actions/action';
import { ActionDisabledReason } from '../actions/action';
import type { DepRegistry } from '../actions/depRegistry';
import type { Tool } from '../../tools/types';
import type { InputEvent } from './matcher';

const MODS = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
const carrying = (kind: 'drop' | 'paste', mime: string): InputEvent =>
  ({ kind, items: [{ mime }], x: 1, y: 2, clientX: 0, clientY: 0, ...MODS } as unknown as InputEvent);

function setup() {
  const ran = vi.fn();
  const take = {
    id: 'take', label: 'take',
    invoker: { timing: 'immediate', run: ran },
    enabled: (_deps: unknown, _at: unknown, carried?: { items: readonly { mime: string }[] }) =>
      (carried?.items.some((it) => it.mime === 'image/png') ? true : ActionDisabledReason.NotApplicable),
  } as unknown as Action;
  const tool = {
    id: 'tool', eligibility: { always: true },
    bindings: [{ spec: { kind: 'drop' }, actionId: 'take' }, { spec: { kind: 'paste' }, actionId: 'take' }],
  } as unknown as Tool;
  const actions = {
    register: vi.fn(), unregister: vi.fn(), mute: vi.fn(), subscribe: vi.fn(),
    trigger: vi.fn(), begin: vi.fn(), setDispatcher: vi.fn(),
    list: () => [take],
  } as unknown as ActionsRegistry;
  const depRegistry: DepRegistry = {
    register: vi.fn().mockReturnValue(() => {}), get: vi.fn() as DepRegistry['get'],
  };
  const ctx: DispatcherContext = {
    depRegistry, actions, activeToolId: 'select', hotkeyStack: [],
    entriesById: new Map([['tool', tool]]), isMac: false,
  };
  return { d: createDispatcher({ getAction: (id) => (id === 'take' ? take : undefined) }), ctx, ran };
}

describe('what an event carries reaches Action.enabled', () => {
  it('predicts a drop by its items', () => {
    const { d, ctx } = setup();
    expect(d.resolveOnly(carrying('drop', 'image/png'), ctx)?.actionId).toBe('take');
    expect(d.resolveOnly(carrying('drop', 'application/pdf'), ctx)).toBeNull();
  });

  it('leaves a paste the action refuses unhandled', () => {
    const { d, ctx, ran } = setup();
    expect(d.handleInput(carrying('paste', 'application/pdf'), ctx)).toBe('unhandled');
    expect(ran).not.toHaveBeenCalled();
    expect(d.handleInput(carrying('paste', 'image/png'), ctx)).toBe('handled');
    expect(ran).toHaveBeenCalledTimes(1);
  });
});
