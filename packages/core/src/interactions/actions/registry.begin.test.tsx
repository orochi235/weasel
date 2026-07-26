import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, useActionsRegistry, type Action, type UiOngoingControl } from './registry';
import { createDispatcher } from '../dispatcher/dispatcher';

function wrap({ children }: { children: ReactNode }) {
  return <ActionsProvider>{children}</ActionsProvider>;
}

function ongoing(id: string): Action {
  return {
    id,
    label: id,
    invoker: {
      timing: 'ongoing',
      start: () => ({ onMove: vi.fn(), onEnd: vi.fn() }),
    },
  };
}

function immediate(id: string): Action {
  return { id, label: id, invoker: { timing: 'immediate', run: vi.fn() } };
}

describe('ActionsRegistry.begin', () => {
  it('returns null with no dispatcher wired', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    act(() => { reg.register(ongoing('foo')); });
    let ctrl: UiOngoingControl | null = null;
    act(() => { ctrl = reg.begin('foo', {}); });
    expect(ctrl).toBeNull();
  });

  it('returns null for an unknown action', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const d = createDispatcher({ getAction: (id) => reg.list().find((a) => a.id === id) });
    act(() => { reg.setDispatcher(d); });
    let ctrl: UiOngoingControl | null = null;
    act(() => { ctrl = reg.begin('missing', {}); });
    expect(ctrl).toBeNull();
  });

  it('returns null for an immediate action', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    act(() => { reg.register(immediate('imm')); });
    const d = createDispatcher({ getAction: (id) => reg.list().find((a) => a.id === id) });
    act(() => { reg.setDispatcher(d); });
    let ctrl: UiOngoingControl | null = null;
    act(() => { ctrl = reg.begin('imm', {}); });
    expect(ctrl).toBeNull();
  });

  it('returns a working control for an ongoing action', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    act(() => { reg.register(ongoing('drag')); });
    const d = createDispatcher({ getAction: (id) => reg.list().find((a) => a.id === id) });
    act(() => { reg.setDispatcher(d); });
    let ctrl: UiOngoingControl | null = null;
    act(() => { ctrl = reg.begin('drag', { foo: 'bar' }); });
    expect(ctrl).not.toBeNull();
    expect(typeof ctrl!.update).toBe('function');
    expect(typeof ctrl!.end).toBe('function');
    act(() => { ctrl!.end('commit'); });
  });
});
