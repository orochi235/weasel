import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import {
  ActionsProvider, ActiveToolContextProvider, DepRegistryProvider, actionBindings, useActionsRegistry,
  useGestureDispatcher, type ActionsRegistry,
} from '@weasel-js/core';
import { FILE_KEYS, useNewCommand, useOpenCommand, useSaveCommand, type FileCommandOptions } from './fileCommands';

function wrap({ children }: { children: ReactNode }) {
  return <ActionsProvider>{children}</ActionsProvider>;
}

function bindingsOf(register: () => void, id: string) {
  const { result } = renderHook(() => { register(); return useActionsRegistry(); }, { wrapper: wrap });
  const action = result.current!.list().find((a) => a.id === id)!;
  return actionBindings(action).map((b) => b.spec);
}

afterEach(cleanup);

function NewOnKeys({ run }: { run: () => void }) {
  useNewCommand('f.new', 'New', run);
  const registry = useActionsRegistry() as ActionsRegistry;
  useGestureDispatcher({ canvasRef: { current: null }, actions: registry, entriesById: new Map(), claimKeys: true });
  return null;
}

describe('file commands', () => {
  it('bind Alt+N, Cmd/Ctrl+O and Cmd/Ctrl+S by default', () => {
    expect(FILE_KEYS.new).toEqual({ kind: 'key', key: 'n', mods: { alt: true } });
    expect(bindingsOf(() => useNewCommand('f.new', 'New', vi.fn()), 'f.new')).toEqual([FILE_KEYS.new]);
    expect(bindingsOf(() => useOpenCommand('f.open', 'Open…', vi.fn()), 'f.open')).toEqual([FILE_KEYS.open]);
    expect(bindingsOf(() => useSaveCommand('f.save', 'Save', vi.fn()), 'f.save')).toEqual([FILE_KEYS.save]);
  });

  it('run New on Option+N, which types a dead key on a Mac', () => {
    const run = vi.fn();
    render(
      <DepRegistryProvider><ActionsProvider><ActiveToolContextProvider>
        <NewOnKeys run={run} />
      </ActiveToolContextProvider></ActionsProvider></DepRegistryProvider>,
    );
    fireEvent.keyDown(document.body, { key: 'Dead', code: 'KeyN', altKey: true });
    expect(run).toHaveBeenCalledOnce();
  });

  it('take other keys in place of the default, and none for null', () => {
    const other: FileCommandOptions = { keys: { kind: 'key', key: 's', mods: { mod: true, shift: true } } };
    expect(bindingsOf(() => useSaveCommand('f.save', 'Save', vi.fn(), other), 'f.save')).toEqual([other.keys]);
    expect(bindingsOf(() => useSaveCommand('f.save', 'Save', vi.fn(), { keys: null }), 'f.save')).toEqual([]);
  });
});
