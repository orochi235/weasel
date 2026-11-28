import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { DepRegistryProvider, useDepSource } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import type { ActionsRegistry } from '../actions/registry';
import type { ActionDeps } from '../actions/invoker';
import { useGestureDispatcher } from './useGestureDispatcher';

const NO_ENTRIES = new Map();
const CHANNELS = { contextMenu: false, ingest: false } as const;

/** A command on the registry in scope, and an app-wide dispatcher with no canvas. */
function AppKeys({ run, yieldKeys }: { run: (by: string) => void; yieldKeys: boolean }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  useEffect(() => registry.register({
    id: 'test.q', label: 'Q', requires: ['by' as never], defaultBinding: { kind: 'key', key: 'q' },
    invoker: { timing: 'immediate' as const, run: (deps: ActionDeps) => run(deps.by === 'canvas' ? 'canvas' : 'app') },
  }), [registry, run]);
  useGestureDispatcher({
    canvasRef: { current: null }, actions: registry, entriesById: NO_ENTRIES,
    channels: CHANNELS, keyboard: 'first', hears: 'own', yieldKeys,
  });
  return null;
}

/** A canvas dispatching on the same registry, so it hears every key the app does; its deps say `by: 'canvas'`,
 *  so a run says whose it is. It holds the keys once pressed, or from mount with `claim`. */
function Canvas({ claim }: { claim: boolean }) {
  return <DepRegistryProvider><CanvasIn claim={claim} /></DepRegistryProvider>;
}

function CanvasIn({ claim }: { claim: boolean }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  const ref = useRef<HTMLDivElement>(null);
  useDepSource('by' as never, (() => 'canvas') as never);
  useGestureDispatcher({ canvasRef: ref, actions: registry, entriesById: NO_ENTRIES, channels: CHANNELS, claimKeys: claim });
  return <div ref={ref} data-testid="canvas" />;
}

/** A keyboard-off canvas that claims nothing. */
function OffCanvas() {
  const registry = useActionsRegistry() as ActionsRegistry;
  const ref = useRef<HTMLDivElement>(null);
  useGestureDispatcher({ canvasRef: ref, actions: registry, entriesById: NO_ENTRIES, channels: CHANNELS, keyboard: false });
  return <div ref={ref} data-testid="off" />;
}

function mount(yieldKeys: boolean, run: (by: string) => void, claim = false) {
  const r = render(
    <DepRegistryProvider><ActionsProvider><ActiveToolContextProvider>
      <AppKeys run={run} yieldKeys={yieldKeys} />
      <Canvas claim={claim} />
    </ActiveToolContextProvider></ActionsProvider></DepRegistryProvider>,
  );
  const holdKeys = () => {
    fireEvent.pointerDown(r.getByTestId('canvas'), { button: 0, pointerId: 1 });
    fireEvent.pointerUp(r.getByTestId('canvas'), { button: 0, pointerId: 1 });
  };
  return { holdKeys };
}

const press = () => act(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true }));
});

describe('useGestureDispatcher — yieldKeys', () => {
  it('hears a key while no canvas holds them', () => {
    const run = vi.fn();
    mount(true, run);
    press();
    expect(run.mock.calls).toEqual([['app']]);
  });

  it('hears none once a canvas on its registry claims the keys on mount, leaving the key to it', () => {
    const run = vi.fn();
    mount(true, run, true);
    press();
    expect(run.mock.calls).toEqual([['canvas']]);
  });

  it('leaves the key to that canvas, which runs it once', () => {
    const run = vi.fn();
    mount(true, run).holdKeys();
    press();
    expect(run.mock.calls).toEqual([['canvas']]);
  });

  it('a press on a canvas with its keyboard channel off does not make it hold the keys', () => {
    const run = vi.fn();
    render(
      <DepRegistryProvider><ActionsProvider><ActiveToolContextProvider>
        <AppKeys run={run} yieldKeys />
        <OffCanvas />
      </ActiveToolContextProvider></ActionsProvider></DepRegistryProvider>,
    );
    fireEvent.pointerDown(document.querySelector('[data-testid="off"]')!, { button: 0, pointerId: 1 });
    press();
    expect(run.mock.calls).toEqual([['app']]);
  });

  it('without it, still hears the key while the canvas holds them', () => {
    const run = vi.fn();
    mount(false, run, true);
    press();
    expect(run.mock.calls).toEqual([['app']]);
  });
});
