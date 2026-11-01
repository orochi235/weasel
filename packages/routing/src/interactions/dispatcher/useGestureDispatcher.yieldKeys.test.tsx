import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import type { ActionsRegistry } from '../actions/registry';
import { useGestureDispatcher } from './useGestureDispatcher';

const NO_ENTRIES = new Map();
const CHANNELS = { contextMenu: false, ingest: false } as const;

/** A command on the registry in scope, and an app-wide dispatcher with no canvas. */
function AppKeys({ run, yieldKeys }: { run: () => void; yieldKeys: boolean }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  useEffect(() => registry.register({
    id: 'test.q', label: 'Q', defaultBinding: { kind: 'key', key: 'q' },
    invoker: { timing: 'immediate' as const, run: () => run() },
  }), [registry, run]);
  useGestureDispatcher({
    canvasRef: { current: null }, actions: registry, entriesById: NO_ENTRIES,
    channels: CHANNELS, keyboard: 'first', hears: 'own', yieldKeys,
  });
  return null;
}

/** A canvas dispatching on the same registry; with `keys` off it hears none, so whatever runs is the app's. */
function Canvas({ keys }: { keys: boolean }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  const ref = useRef<HTMLDivElement>(null);
  useGestureDispatcher({ canvasRef: ref, actions: registry, entriesById: NO_ENTRIES, channels: CHANNELS, keyboard: keys });
  return <div ref={ref} data-testid="canvas" />;
}

function mount(yieldKeys: boolean, run: () => void, canvasKeys = true) {
  const r = render(
    <DepRegistryProvider><ActionsProvider><ActiveToolContextProvider>
      <AppKeys run={run} yieldKeys={yieldKeys} />
      <Canvas keys={canvasKeys} />
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
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('hears none once a canvas on its registry holds the keys', () => {
    const run = vi.fn();
    mount(true, run, false).holdKeys();
    press();
    expect(run).not.toHaveBeenCalled();
  });

  it('leaves the key to that canvas, which runs it once', () => {
    const run = vi.fn();
    mount(true, run).holdKeys();
    press();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('without it, still hears the key while the canvas holds them', () => {
    const run = vi.fn();
    mount(false, run, false).holdKeys();
    press();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
