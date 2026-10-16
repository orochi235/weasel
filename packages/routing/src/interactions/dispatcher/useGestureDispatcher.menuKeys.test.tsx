import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import type { ActionsRegistry } from '../actions/registry';
import { useGestureDispatcher } from './useGestureDispatcher';

function Bound({ run }: { run: () => void }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  useEffect(() => registry.register({
    id: 'test.q', label: 'Q', defaultBinding: { kind: 'key', key: 'q' },
    invoker: { timing: 'immediate' as const, run: () => run() },
  }), [registry, run]);
  useGestureDispatcher({
    canvasRef: { current: null }, actions: registry, entriesById: new Map(),
    channels: { contextMenu: false, ingest: false }, keyboard: 'first',
  });
  return <div role="menu" tabIndex={-1}><div role="menuitem">row</div></div>;
}

describe('useGestureDispatcher — keys inside an open menu', () => {
  it("leaves a key pressed inside role=menu to the menu, even with keyboard: 'first'", () => {
    const run = vi.fn();
    const { getByRole } = render(
      <DepRegistryProvider><ActionsProvider><ActiveToolContextProvider>
        <Bound run={run} />
      </ActiveToolContextProvider></ActionsProvider></DepRegistryProvider>,
    );
    const press = (el: EventTarget) => act(() => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', bubbles: true, cancelable: true }));
    });
    press(getByRole('menuitem'));
    expect(run).not.toHaveBeenCalled();
    press(window);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
