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
    const action: Action = { id: 'foo', label: 'Foo', run: vi.fn() };
    act(() => { reg.register(action); });
    expect(reg.list().map(a => a.id)).toEqual(['foo']);
  });

  it('register returns an unregister; calling it removes the action', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    let unreg: (() => void) | undefined;
    act(() => { unreg = reg.register({ id: 'foo', label: 'Foo', run: vi.fn() }); });
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
    const a1: Action = { id: 'x', label: 'A1', run: vi.fn() };
    const a2: Action = { id: 'x', label: 'A2', run: vi.fn() };
    act(() => { reg.register(a1); reg.register(a2); });
    const list = reg.list();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe('A2');
  });

  it('after unregister, register(default) restores the default', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const def: Action = { id: 'x', label: 'Default', run: vi.fn() };
    const tool: Action = { id: 'x', label: 'Tool', run: vi.fn() };
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
    act(() => { reg.register({ id: 'go', label: 'Go', run }); });
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
    act(() => { reg.register({ id: 'a', label: 'A', run: vi.fn() }); });
    const snap = reg.list() as Action[];
    try { (snap as Action[]).push({ id: 'b', label: 'B', run: vi.fn() }); } catch { /* ignore */ }
    expect(reg.list().map(a => a.id)).toEqual(['a']);
  });

  it('Provider attaches one keydown listener on mount and removes on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const adds = addSpy.mock.calls.filter(c => c[0] === 'keydown').length;
    unmount();
    const removes = removeSpy.mock.calls.filter(c => c[0] === 'keydown').length;
    expect(adds).toBe(1);
    expect(removes).toBe(1);
    addSpy.mockRestore();
    removeSpy.mockRestore();
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
    act(() => { inner!.register({ id: 'a', label: 'A', run: vi.fn() }); });
    expect(inner!.list()).toHaveLength(1);
    expect(outer!.list()).toHaveLength(0);
    unmount();
  });

  it('keydown matches every modifier combination', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const run = vi.fn();
    act(() => { reg.register({
      id: 'sa', label: 'SA',
      defaultBinding: { key: 'a', mod: true },
      run,
    }); });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true }));
    expect(run).toHaveBeenCalledOnce();
    run.mockClear();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    expect(run).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true, altKey: true, bubbles: true }));
    expect(run).not.toHaveBeenCalled();
  });

  it("shift: 'optional' accepts both shifted and unshifted; shift: false rejects shifted; shift: true requires shifted", () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const opt = vi.fn(), no = vi.fn(), yes = vi.fn();
    act(() => {
      reg.register({ id: 'opt', label: 'opt', defaultBinding: { key: 'o', shift: 'optional' }, run: opt });
      reg.register({ id: 'no',  label: 'no',  defaultBinding: { key: 'n' }, run: no });
      reg.register({ id: 'yes', label: 'yes', defaultBinding: { key: 'y', shift: true }, run: yes });
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'o' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'O', shiftKey: true }));
    expect(opt).toHaveBeenCalledTimes(2);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', shiftKey: true }));
    expect(no).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    expect(no).toHaveBeenCalledOnce();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y' }));
    expect(yes).not.toHaveBeenCalled();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', shiftKey: true }));
    expect(yes).toHaveBeenCalledOnce();
  });

  it('skipInEditable: keydowns inside an <input> do NOT trigger', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const run = vi.fn();
    act(() => { reg.register({ id: 'sa', label: 'SA', defaultBinding: { key: 'a', mod: true }, run }); });
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true }));
    expect(run).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('preventDefault is called on the matched event by default', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    act(() => { reg.register({ id: 'sa', label: 'SA', defaultBinding: { key: 'a', mod: true }, run: vi.fn() }); });
    const ev = new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true, cancelable: true });
    const pdSpy = vi.spyOn(ev, 'preventDefault');
    document.dispatchEvent(ev);
    expect(pdSpy).toHaveBeenCalledOnce();
  });

  it('overlapping bindings: first registered runs, others skipped', () => {
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    const a = vi.fn(), b = vi.fn();
    act(() => {
      reg.register({ id: 'a', label: 'A', defaultBinding: { key: 'k' }, run: a });
      reg.register({ id: 'b', label: 'B', defaultBinding: { key: 'k' }, run: b });
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(a).toHaveBeenCalledOnce();
    expect(b).not.toHaveBeenCalled();
  });
});

describe('Action with new invoker / GestureSpec fields (Phase 1 additive)', () => {
  it('accepts an immediate invoker', () => {
    const action: Action = {
      id: 'demo.immediate',
      label: 'Demo immediate',
      run: () => {},
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
      run: () => {},
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
      run: () => {},
    };
    expect(action.defaultBinding).toEqual({ kind: 'wheel', mods: { ctrl: true } });
  });

  it('legacy KeyBinding shape on defaultBinding still compiles', () => {
    const action: Action = {
      id: 'demo.legacy',
      label: 'Demo legacy',
      defaultBinding: { key: 'a', mod: true },
      run: () => {},
    };
    expect(action.defaultBinding).toBeDefined();
  });
});
