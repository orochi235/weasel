import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { ActionDisabledReason, type ActionsRegistry } from '@weasel-js/routing';
import {
  ActionsProvider, ActiveToolContextProvider, DepRegistryProvider, useActionsRegistry, useCommand, useGestureDispatcher,
} from '@weasel-js/routing/react';
import type { ReactNode } from 'react';
import { renderWithIcons } from '../../testing/withIcons';
import { ToastRegion } from './Toast';
import { createToastQueue } from './queue';

function Duplicate() {
  const registry = useActionsRegistry() as ActionsRegistry;
  useCommand('edit.duplicate', 'Duplicate', () => {}, {
    keys: { kind: 'key', key: 'd' },
    enabled: () => ActionDisabledReason.SelectionRequired,
  });
  useGestureDispatcher({
    canvasRef: { current: null }, actions: registry, entriesById: new Map(),
    channels: { contextMenu: false, ingest: false }, keyboard: 'page',
  });
  return null;
}

function App({ children }: { children: ReactNode }) {
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <Duplicate />
          {children}
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

const press = () => {
  fireEvent.keyDown(document.body, { key: 'd' });
  act(() => { vi.advanceTimersByTime(1); });
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ToastRegion and a refused command', () => {
  it('says which command its key reached and why it would not run', () => {
    renderWithIcons(<App><ToastRegion queue={createToastQueue()} /></App>);
    press();
    expect(screen.getByText('Duplicate')).toBeTruthy();
    expect(screen.getByText('Selection required')).toBeTruthy();
  });

  it('replaces the last refusal rather than stacking another', () => {
    renderWithIcons(<App><ToastRegion queue={createToastQueue()} /></App>);
    press();
    press();
    expect(screen.getAllByText('Selection required')).toHaveLength(1);
  });

  it('tells it in the region mounted last, and in none told not to', () => {
    renderWithIcons(
      <App>
        <ToastRegion queue={createToastQueue()} className="first" />
        <ToastRegion queue={createToastQueue()} className="second" />
        <ToastRegion queue={createToastQueue()} className="quiet" refusals={false} />
      </App>,
    );
    press();
    const told = screen.getAllByText('Selection required');
    expect(told).toHaveLength(1);
    expect(told[0]!.closest('.second')).not.toBeNull();
  });
});
