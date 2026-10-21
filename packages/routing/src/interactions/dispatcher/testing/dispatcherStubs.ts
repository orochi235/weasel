/** Stubs for the pure dispatcher's tests: no React, no DOM, no real registry. */
import { vi, type Mock } from 'vitest';
import type { DispatcherContext } from '../dispatcher';
import type { ActionsRegistry } from '../../actions/registry';
import type { Action } from '../../actions/action';
import type { DepRegistry } from '../../actions/depRegistry';
import type { InputEvent } from '../matcher';

export function makeRegistry(actions: Action[]): ActionsRegistry {
  const map = new Map(actions.map((a) => [a.id, a]));
  return {
    register: vi.fn().mockReturnValue(() => {}),
    unregister: vi.fn(),
    mute: vi.fn().mockReturnValue(() => {}),
    tune: vi.fn().mockReturnValue(() => {}),
    paramsOf: (_id: string, given?: Record<string, unknown>) => ({ ...given }),
    overrideBindings: vi.fn().mockReturnValue(() => {}),
    bindingOverrides: () => new Map(),
    list: () => Array.from(map.values()),
    trigger: vi.fn().mockReturnValue(false),
    preview: vi.fn(() => () => {}),
    subscribe: vi.fn().mockReturnValue(() => {}),
    begin: vi.fn().mockReturnValue(null),
    setDispatcher: vi.fn(),
    activate: vi.fn(),
    isActive: () => true,
    holdsKeys: () => true,
    dropKeys: () => {},
  };
}

export function makeDepRegistry(deps: Record<string, unknown> = {}): DepRegistry {
  return {
    register: vi.fn().mockReturnValue(() => {}),
    get: vi.fn((name: string) => deps[name]) as DepRegistry['get'],
  };
}

export function makeCtx(
  overrides: Partial<DispatcherContext> & { actions: ActionsRegistry },
): DispatcherContext {
  return {
    depRegistry: makeDepRegistry(),
    activeToolId: 'select',
    hotkeyStack: [],
    entriesById: new Map(),
    isMac: false,
    ...overrides,
  };
}

/** A minimal immediate action. */
export function immediateAction(id: string, gestureKey: string, run: Mock = vi.fn()): Action {
  return {
    id,
    label: id,
    defaultBinding: { kind: 'key', key: gestureKey },
    invoker: { timing: 'immediate', run },
  };
}

/** Key-held ongoing action (pointerdown also supported via kind override). */
export function ongoingAction(
  id: string,
  spec: Action['defaultBinding'],
  startFn: Mock = vi.fn().mockReturnValue({}),
): Action {
  return {
    id,
    label: id,
    defaultBinding: spec,
    invoker: { timing: 'ongoing', start: startFn },
  };
}

export const keyAEvent: InputEvent = {
  kind: 'key',
  key: 'a',
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};
