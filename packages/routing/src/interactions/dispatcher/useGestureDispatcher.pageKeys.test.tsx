import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { useEffect } from 'react';
import { matchKeyEvent } from '@weasel-js/gestures';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import type { ActionsRegistry } from '../actions/registry';
import { useGestureDispatcher } from './useGestureDispatcher';

const NO_ENTRIES = new Map();
const CHANNELS = { contextMenu: false, ingest: false } as const;

function AppKeys({ run, keyboard }: { run: () => void; keyboard: 'first' | 'page' }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  useEffect(() => registry.register({
    id: 'test.q', label: 'Q', defaultBinding: { kind: 'key', key: 'q' },
    invoker: { timing: 'immediate' as const, run: () => run() },
  }), [registry, run]);
  useGestureDispatcher({
    canvasRef: { current: null }, actions: registry, entriesById: NO_ENTRIES,
    channels: CHANNELS, keyboard, hears: 'own',
  });
  return null;
}

function mount(keyboard: 'first' | 'page', widget: () => void, onWindow: () => void) {
  const run = vi.fn();
  const view = render(
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <AppKeys run={run} keyboard={keyboard} />
          <div
            data-testid="widget"
            tabIndex={0}
            onKeyDown={(e) => {
              if (!matchKeyEvent(e, 'q')) return;
              widget();
              e.preventDefault();
            }}
          />
          <div data-testid="other" tabIndex={0} />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>,
  );
  const onWin = (e: KeyboardEvent) => { if (!e.defaultPrevented) onWindow(); };
  window.addEventListener('keydown', onWin);
  return { run, view, off: () => window.removeEventListener('keydown', onWin) };
}

describe("useGestureDispatcher keyboard: 'page'", () => {
  it('leaves a key to the focused widget that takes it, which a first dispatcher takes ahead of it', () => {
    const widget = vi.fn();
    const page = mount('page', widget, () => {});
    fireEvent.keyDown(page.view.getByTestId('widget'), { key: 'q' });
    expect(widget).toHaveBeenCalledTimes(1);
    expect(page.run).not.toHaveBeenCalled();
    page.off();
    page.view.unmount();

    const first = mount('first', widget, () => {});
    fireEvent.keyDown(first.view.getByTestId('widget'), { key: 'q' });
    expect(first.run).toHaveBeenCalledTimes(1);
    first.off();
  });

  it('takes a key the focused element declines ahead of every listener on window', () => {
    const onWindow = vi.fn();
    const page = mount('page', () => {}, onWindow);
    fireEvent.keyDown(page.view.getByTestId('other'), { key: 'q' });
    expect(page.run).toHaveBeenCalledTimes(1);
    expect(onWindow).not.toHaveBeenCalled();
    page.off();
  });
});
