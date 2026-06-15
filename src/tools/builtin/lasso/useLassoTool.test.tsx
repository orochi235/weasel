import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useLassoTool } from './useLassoTool';
import type { LassoSelectAdapter } from 'core/adapters/types';

function makeAdapter(hits: string[] = []): LassoSelectAdapter & { applyOps: ReturnType<typeof vi.fn> } {
  const applyOps = vi.fn();
  return {
    hitTestLasso: () => hits,
    hitTestArea: () => [],
    getSelection: () => [],
    setSelection: () => {},
    applyOps,
  };
}

describe('useLassoTool', () => {
  // Legacy `useLassoSelect` hook removed. Drag flows
  // entirely through `lassoSelectAction` via the gesture dispatcher; the
  // tool itself only declares id/keybinding/cursor/presentation + the
  // dispatcher binding. The route-table drag entry is gone, so tests that
  // exercised `tool.drag.onStart/onMove/onEnd` directly are also gone —
  // those paths are covered by `lassoSelectAction`'s own tests.
  it("declares id 'lasso' and keybinding { key: 'L' } by default", () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter));
    expect(result.current.id).toBe('lasso');
    expect(result.current.keybinding).toEqual({ key: 'L' });
  });

  it("keybinding override: passing keybinding: null omits it", () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter, { keybinding: null }));
    expect(result.current.keybinding).toBeUndefined();
  });

  it("custom keybinding passes through", () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter, { keybinding: { key: 'L', shift: true } }));
    expect(result.current.keybinding).toEqual({ key: 'L', shift: true });
  });

  it('declares the dispatcher binding for lassoSelect', () => {
    const adapter = makeAdapter();
    const { result } = renderHook(() => useLassoTool(adapter));
    const bindings = result.current.bindings ?? [];
    expect(bindings.length).toBe(1);
    expect(bindings[0].actionId).toBe('lassoSelect');
    expect(bindings[0].spec.kind).toBe('drag');
  });
});
