import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, actionBindings, useActionsRegistry } from '@weasel-js/core';
import { FILE_KEYS, useNewCommand, useOpenCommand, useSaveCommand, type FileCommandOptions } from './fileCommands';

function wrap({ children }: { children: ReactNode }) {
  return <ActionsProvider>{children}</ActionsProvider>;
}

function bindingsOf(register: () => void, id: string) {
  const { result } = renderHook(() => { register(); return useActionsRegistry(); }, { wrapper: wrap });
  const action = result.current!.list().find((a) => a.id === id)!;
  return actionBindings(action).map((b) => b.spec);
}

describe('file commands', () => {
  it('bind Cmd/Ctrl+N, O and S by default', () => {
    expect(bindingsOf(() => useNewCommand('f.new', 'New', vi.fn()), 'f.new')).toEqual([FILE_KEYS.new]);
    expect(bindingsOf(() => useOpenCommand('f.open', 'Open…', vi.fn()), 'f.open')).toEqual([FILE_KEYS.open]);
    expect(bindingsOf(() => useSaveCommand('f.save', 'Save', vi.fn()), 'f.save')).toEqual([FILE_KEYS.save]);
  });

  it('take other keys in place of the default, and none for null', () => {
    const other: FileCommandOptions = { keys: { kind: 'key', key: 's', mods: { mod: true, shift: true } } };
    expect(bindingsOf(() => useSaveCommand('f.save', 'Save', vi.fn(), other), 'f.save')).toEqual([other.keys]);
    expect(bindingsOf(() => useSaveCommand('f.save', 'Save', vi.fn(), { keys: null }), 'f.save')).toEqual([]);
  });
});
