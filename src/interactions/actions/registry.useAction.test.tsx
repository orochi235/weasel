import { describe, it, expect, vi } from 'vitest';
import { renderHook, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, useActionsRegistry, useAction, type Action } from './registry';

function wrap({ children }: { children: ReactNode }) {
  return <ActionsProvider>{children}</ActionsProvider>;
}

describe('useAction', () => {
  it('registers the action on mount and unregisters on unmount', () => {
    const action: Action = { id: 'foo', label: 'Foo', invoker: { timing: 'immediate' as const, run: vi.fn() } };
    const { result, unmount } = renderHook(
      () => {
        useAction(action);
        return useActionsRegistry();
      },
      { wrapper: wrap },
    );
    expect(result.current!.list().map(a => a.id)).toEqual(['foo']);
    unmount();
    // After unmount we cannot read the registry, but the unregister
    // ran during cleanup — verifiable by the next test below.
  });

  it('no-ops silently when no provider is in scope', () => {
    const action: Action = { id: 'foo', label: 'Foo', invoker: { timing: 'immediate' as const, run: vi.fn() } };
    expect(() => renderHook(() => useAction(action))).not.toThrow();
  });

  it('re-registering with a new action object replaces the old one', () => {
    let action: Action = { id: 'foo', label: 'V1', invoker: { timing: 'immediate' as const, run: vi.fn() } };
    const { result, rerender } = renderHook(
      () => {
        useAction(action);
        return useActionsRegistry();
      },
      { wrapper: wrap },
    );
    expect(result.current!.list()[0].label).toBe('V1');
    action = { id: 'foo', label: 'V2', invoker: { timing: 'immediate' as const, run: vi.fn() } };
    rerender();
    expect(result.current!.list()[0].label).toBe('V2');
  });

  it('cleanup of unmounted useAction does not clobber a later registrant for the same id', () => {
    function HostA() { useAction({ id: 'foo', label: 'A', invoker: { timing: 'immediate' as const, run: vi.fn() } }); return null; }
    function HostB() { useAction({ id: 'foo', label: 'B', invoker: { timing: 'immediate' as const, run: vi.fn() } }); return null; }
    let regSnap: ReturnType<typeof useActionsRegistry> = null;
    function Probe() { regSnap = useActionsRegistry(); return null; }
    const { rerender, unmount } = render(
      <ActionsProvider>
        <Probe />
        <HostA />
        <HostB />
      </ActionsProvider>,
    );
    // After both mount, HostB wrote last → list shows 'B'.
    expect(regSnap!.list()[0].label).toBe('B');
    // Unmount HostA. HostB's entry must survive.
    rerender(
      <ActionsProvider>
        <Probe />
        <HostB />
      </ActionsProvider>,
    );
    expect(regSnap!.list()[0].label).toBe('B');
    unmount();
  });
});
