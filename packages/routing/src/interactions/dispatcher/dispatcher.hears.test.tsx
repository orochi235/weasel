/**
 * What a dispatcher on a root registry hears of the scopes below it — the
 * shape of chrome on a lab whose trials' canvases mount their scopes under it.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { useGestureDispatcher } from './useGestureDispatcher';
import type { UseGestureDispatcherOptions } from './gestureDispatcherOptions';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { InputScope } from '../actions/inputScope';
import type { Action } from '../actions/action';
import type { ActionsRegistry } from '../actions/registry';

const NO_ENTRIES = new Map();
const NO_CANVAS = { current: null };
const CHANNELS = { contextMenu: false, ingest: false } as const;

function Root({ children }: { children: ReactNode }): ReactNode {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>{children}</ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

function keyAction(id: string, key: string, run: () => void): Action {
  return {
    id, label: id, defaultBinding: { kind: 'key', key },
    invoker: { timing: 'immediate', run: () => run() },
  };
}

function Registers({ action }: { action: Action }): ReactNode {
  const registry = useActionsRegistry()!;
  useEffect(() => registry.register(action), [registry, action]);
  return null;
}

function Grab({ into }: { into: { current: ActionsRegistry | null } }): ReactNode {
  into.current = useActionsRegistry();
  return null;
}

function Chrome({ hears }: { hears?: UseGestureDispatcherOptions['hears'] }): ReactNode {
  const registry = useActionsRegistry()!;
  useGestureDispatcher({
    canvasRef: NO_CANVAS, actions: registry, entriesById: NO_ENTRIES,
    channels: CHANNELS, keyboard: 'first', ...(hears ? { hears } : {}),
  });
  return null;
}

const press = (key: string): void => { act(() => { fireEvent.keyDown(window, { key }); }); };

describe('a root registry over the scopes below it', () => {
  it('lists and triggers an action registered in an <InputScope> below it', () => {
    const root: { current: ActionsRegistry | null } = { current: null };
    const childRun = vi.fn();
    render(
      <Root>
        <Grab into={root} />
        <InputScope><Registers action={keyAction('child.x', 'x', childRun)} /></InputScope>
      </Root>,
    );
    expect(root.current!.list().map((a) => a.id)).toContain('child.x');
    expect(root.current!.trigger('child.x')).toBe(true);
    expect(childRun).toHaveBeenCalledTimes(1);
  });

  it('does not reach an action registered under a nested <ActionsProvider>, which is a root of its own', () => {
    const root: { current: ActionsRegistry | null } = { current: null };
    const inner: { current: ActionsRegistry | null } = { current: null };
    const innerRun = vi.fn();
    render(
      <Root>
        <Grab into={root} />
        <Root>
          <Grab into={inner} />
          <Registers action={keyAction('inner.x', 'x', innerRun)} />
        </Root>
      </Root>,
    );
    expect(root.current!.list().map((a) => a.id)).not.toContain('inner.x');
    expect(root.current!.trigger('inner.x')).toBe(false);
    expect(inner.current!.list().map((a) => a.id)).toContain('inner.x');
  });
});

describe("a dispatcher's hears option", () => {
  it("with hears 'own', does not run a key bound in a scope below its registry", () => {
    const childRun = vi.fn();
    render(
      <Root>
        <Chrome hears="own" />
        <InputScope><Registers action={keyAction('child.x', 'x', childRun)} /></InputScope>
      </Root>,
    );
    press('x');
    expect(childRun).not.toHaveBeenCalled();
  });

  it("with hears 'own', runs a key bound at its own node", () => {
    const rootRun = vi.fn();
    render(
      <Root>
        <Chrome hears="own" />
        <Registers action={keyAction('root.y', 'y', rootRun)} />
        <InputScope><Registers action={keyAction('child.x', 'x', vi.fn())} /></InputScope>
      </Root>,
    );
    press('y');
    expect(rootRun).toHaveBeenCalledTimes(1);
  });

  it('by default still runs a key bound in the active scope below it', () => {
    const childRun = vi.fn();
    render(
      <Root>
        <Chrome />
        <InputScope><Registers action={keyAction('child.x', 'x', childRun)} /></InputScope>
      </Root>,
    );
    press('x');
    expect(childRun).toHaveBeenCalledTimes(1);
  });
});
