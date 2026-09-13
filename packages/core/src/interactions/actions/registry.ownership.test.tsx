import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { UiOngoingControl } from '@weasel-js/routing';
import { ActionsProvider, useActionsRegistry } from '@weasel-js/routing/react';
import type { Action } from '@weasel-js/routing';
import { createDispatcher } from '@weasel-js/routing';

function wrap({ children }: { children: ReactNode }) {
  return <ActionsProvider>{children}</ActionsProvider>;
}

function ongoing(id: string): Action {
  return {
    id,
    label: id,
    invoker: { timing: 'ongoing', start: () => ({ onMove: vi.fn(), onEnd: vi.fn() }) },
  };
}

/** Registry with one ongoing action registered, plus a dispatcher factory. */
function setup() {
  const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
  const reg = result.current!;
  act(() => { reg.register(ongoing('foo')); });
  const makeDispatcher = () =>
    createDispatcher({ getAction: (id) => reg.list().find((a) => a.id === id) });
  /** `begin` only delegates when a dispatcher owns the slot. */
  const slotIsWired = () => {
    let ctrl: UiOngoingControl | null = null;
    act(() => { ctrl = reg.begin('foo', {}); });
    if (ctrl) act(() => { (ctrl as UiOngoingControl).end('cancel'); });
    return ctrl !== null;
  };
  return { reg, makeDispatcher, slotIsWired };
}

describe('ActionsRegistry dispatcher ownership', () => {
  it('clears the slot when the canvas that filled it releases', () => {
    const { reg, makeDispatcher, slotIsWired } = setup();
    let release: () => void = () => {};
    act(() => { release = reg.setDispatcher(makeDispatcher()); });
    expect(slotIsWired()).toBe(true);
    act(() => { release(); });
    expect(slotIsWired()).toBe(false);
  });

  // The reported failure: two canvases share a registry, then either one
  // unmounting takes input away from the one still on screen.
  it('leaves the slot alone when a canvas that was already displaced releases', () => {
    const { reg, makeDispatcher, slotIsWired } = setup();
    let releaseFirst: () => void = () => {};
    act(() => { releaseFirst = reg.setDispatcher(makeDispatcher()); });
    act(() => { reg.setDispatcher(makeDispatcher()); });
    act(() => { releaseFirst(); });
    expect(slotIsWired()).toBe(true);
  });

  // The other half of the same report, and the half that was never
  // implemented: the canvas still on screen is the DISPLACED one, and the
  // displacer's release nulls the slot out from under it. Every neighbouring
  // registration in ActionsProvider is a stack for exactly this reason.
  it('uncovers the displaced canvas when the displacer releases', () => {
    const { reg, makeDispatcher, slotIsWired } = setup();
    act(() => { reg.setDispatcher(makeDispatcher()); });
    let releaseSecond: () => void = () => {};
    act(() => { releaseSecond = reg.setDispatcher(makeDispatcher()); });
    act(() => { releaseSecond(); });
    expect(slotIsWired()).toBe(true);
  });

  it('empties the slot only once every canvas has released', () => {
    const { reg, makeDispatcher, slotIsWired } = setup();
    let releaseFirst: () => void = () => {};
    let releaseSecond: () => void = () => {};
    act(() => { releaseFirst = reg.setDispatcher(makeDispatcher()); });
    act(() => { releaseSecond = reg.setDispatcher(makeDispatcher()); });
    act(() => { releaseSecond(); });
    act(() => { releaseFirst(); });
    expect(slotIsWired()).toBe(false);
  });

  it('names the collision rather than failing silently', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { reg, makeDispatcher } = setup();
    act(() => { reg.setDispatcher(makeDispatcher()); });
    expect(warn).not.toHaveBeenCalled();
    act(() => { reg.setDispatcher(makeDispatcher()); });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('WeaselProvider isolate');
    // Says it once: the message is about the scope, not about which canvas lost.
    act(() => { reg.setDispatcher(makeDispatcher()); });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('stays quiet when one canvas re-wires its own dispatcher', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { reg, makeDispatcher } = setup();
    let release: () => void = () => {};
    act(() => { release = reg.setDispatcher(makeDispatcher()); });
    // React runs the previous effect's cleanup before the next effect.
    act(() => { release(); });
    act(() => { reg.setDispatcher(makeDispatcher()); });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('ActionsRegistry dep-registry ownership', () => {
  const depsFor = (value: string) => ({ get: (n: string) => (n === 'selection' ? value : undefined) }) as never;

  it('leaves the dep registry alone when a displaced owner releases', () => {
    const seen: string[] = [];
    const action: Action & { requires: string[] } = {
      id: 'peek',
      label: 'peek',
      requires: ['selection'],
      invoker: {
        timing: 'ongoing',
        start: (ctx) => {
          seen.push((ctx.deps as Record<string, string>).selection);
          return { onMove: vi.fn(), onEnd: vi.fn() };
        },
      },
    };
    const { result } = renderHook(() => useActionsRegistry(), { wrapper: wrap });
    const reg = result.current!;
    act(() => { reg.register(action); });
    act(() => { reg.setDispatcher(createDispatcher({ getAction: (id) => reg.list().find((a) => a.id === id) })); });

    let releaseFirst: () => void = () => {};
    act(() => { releaseFirst = reg.setDepRegistry(depsFor('first')); });
    act(() => { reg.setDepRegistry(depsFor('second')); });
    act(() => { releaseFirst(); });

    let ctrl: UiOngoingControl | null = null;
    act(() => { ctrl = reg.begin('peek', {}); });
    act(() => { (ctrl as unknown as UiOngoingControl).end('cancel'); });
    expect(seen[0]).toBe('second');
  });
});
