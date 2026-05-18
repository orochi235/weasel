import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, useActionsRegistry, type Action, type ActionsRegistry } from './registry';
import type { GestureSpec } from '../gestures/spec';

function wrap({ children }: { children: ReactNode }) {
  return <ActionsProvider>{children}</ActionsProvider>;
}

describe('ActionsRegistry', () => {
  it('register(action) adds the action; list() returns it', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const action: Action = { id: 'foo', label: 'Foo', invoker: { timing: 'immediate' as const, run: vi.fn() } };
    act(() => { reg.register(action); });
    expect(reg.list().map(a => a.id)).toEqual(['foo']);
  });

  it('register returns an unregister; calling it removes the action', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    let unreg: (() => void) | undefined;
    act(() => { unreg = reg.register({ id: 'foo', label: 'Foo', invoker: { timing: 'immediate' as const, run: vi.fn() } }); });
    act(() => { unreg!(); });
    expect(reg.list()).toEqual([]);
  });

  it('useActionsRegistry returns null when no provider', () => {
    const { result } = renderHook(() => useActionsRegistry());
    expect(result.current).toBeNull();
  });
});

describe('ActionsRegistry — full coverage', () => {
  it('register with same id replaces the existing entry (last-writer-wins)', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const a1: Action = { id: 'x', label: 'A1', invoker: { timing: 'immediate' as const, run: vi.fn() } };
    const a2: Action = { id: 'x', label: 'A2', invoker: { timing: 'immediate' as const, run: vi.fn() } };
    act(() => { reg.register(a1); reg.register(a2); });
    const list = reg.list();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('A2');
  });

  it('after unregister, register(default) restores the default', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const def: Action = { id: 'x', label: 'Default', invoker: { timing: 'immediate' as const, run: vi.fn() } };
    const tool: Action = { id: 'x', label: 'Tool', invoker: { timing: 'immediate' as const, run: vi.fn() } };
    act(() => { reg.register(def); });
    let unregTool: (() => void) | undefined;
    act(() => { unregTool = reg.register(tool); });
    expect(reg.list()[0].label).toBe('Tool');
    act(() => { unregTool!(); reg.register(def); });
    expect(reg.list()[0].label).toBe('Default');
  });

  it('unregister(id) for an absent id is a no-op', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    expect(() => act(() => { reg.unregister('missing'); })).not.toThrow();
  });

  it('trigger(id) calls run and returns true', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const run = vi.fn();
    act(() => { reg.register({ id: 'go', label: 'Go', invoker: { timing: 'immediate', run: () => { run(); } } }); });
    let ret = false;
    act(() => { ret = reg.trigger('go'); });
    expect(run).toHaveBeenCalledOnce();
    expect(ret).toBe(true);
  });

  it('trigger(id) for absent id returns false (no throw)', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    let ret = true;
    expect(() => act(() => { ret = reg.trigger('missing'); })).not.toThrow();
    expect(ret).toBe(false);
  });

  it('list() snapshot mutation does not affect internal state', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    act(() => { reg.register({ id: 'a', label: 'A', invoker: { timing: 'immediate' as const, run: vi.fn() } }); });
    const snap = reg.list() as Action[];
    try { (snap as Action[]).push({ id: 'b', label: 'B', invoker: { timing: 'immediate' as const, run: vi.fn() } }); } catch { /* ignore */ }
    expect(reg.list().map(a => a.id)).toEqual(['a']);
  });

  it('Provider attaches no document keydown listener (Phase 14e Task 7: dispatcher owns keystrokes)', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const { unmount } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const adds = addSpy.mock.calls.filter(c => c[0] === 'keydown').length;
    unmount();
    expect(adds).toBe(0);
    addSpy.mockRestore();
  });

  it('nested providers each own their own scope', () => {
    let outer: ActionsRegistry | null = null;
    let inner: ActionsRegistry | null = null;
    function CaptureOuter() { outer = useActionsRegistry(); return null; }
    function CaptureInner() { inner = useActionsRegistry(); return null; }
    const { unmount } = render(
      <ActionsProvider>
        <CaptureOuter />
        <ActionsProvider>
          <CaptureInner />
        </ActionsProvider>
      </ActionsProvider>,
    );
    expect(outer).not.toBe(inner);
    act(() => { inner!.register({ id: 'a', label: 'A', invoker: { timing: 'immediate' as const, run: vi.fn() } }); });
    expect(inner!.list()).toHaveLength(1);
    expect(outer!.list()).toHaveLength(0);
    unmount();
  });

  // Phase 14e Task 7: the keystroke-matching tests (modifier combos, shift
  // policies, skipInEditable, preventDefault, overlapping-bindings tiebreak)
  // tested the registry's legacy keydown loop, which is gone. Equivalent
  // coverage lives in the gesture dispatcher's tests
  // (`src/interactions/dispatcher/`) which is now the sole keystroke path
  // for registered actions with `defaultBinding`.
});

describe('Action with new invoker / GestureSpec fields (Phase 1 additive)', () => {
  it('accepts an immediate invoker', () => {
    const action: Action = {
      id: 'demo.immediate',
      label: 'Demo immediate',
      invoker: {
        timing: 'immediate',
        run: (_deps) => {},
      },
    };
    expect(action.invoker?.timing).toBe('immediate');
  });

  it('accepts an ongoing invoker', () => {
    const action: Action = {
      id: 'demo.ongoing',
      label: 'Demo ongoing',
      invoker: {
        timing: 'ongoing',
        start: () => ({}),
      },
    };
    expect(action.invoker?.timing).toBe('ongoing');
  });

  it('accepts a GestureSpec on defaultBinding', () => {
    const gestureSpec: GestureSpec = { kind: 'wheel', mods: { ctrl: true } };
    const action: Action = {
      id: 'demo.wheel',
      label: 'Demo wheel',
      defaultBinding: gestureSpec,
      invoker: { timing: 'immediate', run: () => {} },
    };
    expect(action.defaultBinding).toEqual({ kind: 'wheel', mods: { ctrl: true } });
  });

  // REMOVED (Phase 14e Task 7): 'legacy KeyBinding shape on defaultBinding
  // still compiles'. The `Action.defaultBinding` field has been deleted; all
  // bindings live on `defaultBinding` (read by the dispatcher).

  it('accepts an array of GestureSpec on defaultBinding (multi-binding actions)', () => {
    const action: Action = {
      id: 'demo.multi',
      label: 'Demo multi',
      defaultBinding: [
        { kind: 'key', key: 'z', mods: { mod: true } },
        { kind: 'key', key: 'z', mods: { mod: true, shift: true } },
      ],
      invoker: { timing: 'immediate', run: () => {} },
    };
    expect(Array.isArray(action.defaultBinding)).toBe(true);
  });
});
