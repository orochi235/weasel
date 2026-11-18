import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useEffect } from 'react';
import { ActionsProvider, useActionsRegistry } from '../actions/ActionsProvider';
import { DepRegistryProvider } from '../actions/depRegistry';
import { ActiveToolContextProvider } from '../actions/activeToolContext';
import type { Action } from '../actions/action';
import type { ActionsRegistry } from '../actions/registry';
import { subscribeRefusals, type Refusal } from '../actions/refusal';
import { useGestureDispatcher } from './useGestureDispatcher';

const NO_ENTRIES = new Map();
const CHANNELS = { contextMenu: false, ingest: false } as const;
const WHY = 'Select something first';

const action = (id: string, enabled: Action['enabled'], run = vi.fn()): Action => ({
  id, label: id, defaultBinding: { kind: 'key', key: 'q' }, enabled, invoker: { timing: 'immediate', run },
});

function PageKeys({ actions }: { actions: readonly Action[] }) {
  const registry = useActionsRegistry() as ActionsRegistry;
  useEffect(() => {
    const releases = actions.map((a) => registry.register(a));
    return () => { for (const release of releases) release(); };
  }, [registry, actions]);
  useGestureDispatcher({
    canvasRef: { current: null }, actions: registry, entriesById: NO_ENTRIES, channels: CHANNELS, keyboard: 'page',
  });
  return null;
}

function mount(actions: readonly Action[]): Refusal[] {
  const heard: Refusal[] = [];
  const stop = subscribeRefusals((r) => heard.push(r));
  render(
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider>
          <PageKeys actions={actions} />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>,
  );
  cleanups.push(stop);
  return heard;
}

const cleanups: (() => void)[] = [];
const settle = () => act(() => { vi.runAllTimers(); });

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout'] }); });
afterEach(() => {
  cleanup();
  for (const c of cleanups.splice(0)) c();
  vi.useRealTimers();
});

describe('a key that reaches only a refused command', () => {
  it('reports the command and its reason, once nothing else took the keystroke', () => {
    const heard = mount([action('edit.dup', () => WHY)]);
    fireEvent.keyDown(document.body, { key: 'q' });
    expect(heard).toEqual([]);
    settle();
    expect(heard.map((r) => [r.action.id, r.reason])).toEqual([['edit.dup', WHY]]);
  });

  it('reports nothing when another action on the key runs', () => {
    const run = vi.fn();
    const heard = mount([action('edit.dup', () => WHY), action('edit.other', undefined, run)]);
    fireEvent.keyDown(document.body, { key: 'q' });
    settle();
    expect(run).toHaveBeenCalledOnce();
    expect(heard).toEqual([]);
  });

  it('reports nothing when a later listener on the page takes the keystroke', () => {
    const heard = mount([action('edit.dup', () => WHY)]);
    const take = (e: KeyboardEvent) => e.preventDefault();
    window.addEventListener('keydown', take);
    fireEvent.keyDown(document.body, { key: 'q' });
    window.removeEventListener('keydown', take);
    settle();
    expect(heard).toEqual([]);
  });

  it('reports nothing for an autorepeat, or for a command that runs', () => {
    const run = vi.fn();
    const heard = mount([action('edit.dup', () => WHY)]);
    fireEvent.keyDown(document.body, { key: 'q', repeat: true });
    settle();
    expect(heard).toEqual([]);
    cleanup();
    const ran = mount([action('edit.ok', () => true, run)]);
    fireEvent.keyDown(document.body, { key: 'q' });
    settle();
    expect(run).toHaveBeenCalledOnce();
    expect(ran).toEqual([]);
  });
});
