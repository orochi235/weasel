import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { createPointerStore, PointerContextProvider, usePointerContext, usePointerPosition, type PointerContextValue } from './PointerContext';

describe('pointer store', () => {
  it('notifies subscribers once per change, and not for an equal value', () => {
    const store = createPointerStore();
    const fn = vi.fn();
    store.subscribe(fn);
    store.set({ world: { x: 1, y: 2 }, viewId: null });
    store.set({ world: { x: 1, y: 2 }, viewId: null });
    expect(fn).toHaveBeenCalledTimes(1);
    store.set({ world: { x: 1, y: 2 }, viewId: 'mini' });
    store.set(null);
    store.set(null);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(store.getVersion()).toBe(3);
  });

  it('stops notifying after unsubscribe', () => {
    const store = createPointerStore();
    const fn = vi.fn();
    const off = store.subscribe(fn);
    off();
    store.set({ world: { x: 0, y: 0 }, viewId: null });
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('usePointerPosition', () => {
  it('re-renders with each published position', () => {
    let store: PointerContextValue | null = null;
    const seen: unknown[] = [];
    function Probe() {
      store = usePointerContext();
      seen.push(usePointerPosition());
      return null;
    }
    render(<PointerContextProvider><Probe /></PointerContextProvider>);
    act(() => store!.set({ world: { x: 3, y: 4 }, viewId: 'v' }));
    expect(seen.at(-1)).toEqual({ world: { x: 3, y: 4 }, viewId: 'v' });
  });

  it('answers null outside a provider', () => {
    let pos: unknown = 'unset';
    function Probe() { pos = usePointerPosition(); return null; }
    render(<Probe />);
    expect(pos).toBeNull();
  });
});
