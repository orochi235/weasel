import { describe, expect, it, vi } from 'vitest';
import { dispatcherWatch } from './dispatcherWatch';
import type { Dispatcher } from './dispatcherApi';

function fakeDispatcher() {
  const listeners = new Set<() => void>();
  const dispatcher = {
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => { listeners.delete(fn); };
    },
  } as unknown as Dispatcher;
  return { dispatcher, listeners, notify: () => { for (const fn of listeners) fn(); } };
}

describe('dispatcherWatch', () => {
  it('subscribes once to each live dispatcher', () => {
    const onChange = vi.fn();
    const a = fakeDispatcher();
    const watch = dispatcherWatch(onChange);
    watch.sync([a.dispatcher]);
    watch.sync([a.dispatcher]);
    expect(a.listeners.size).toBe(1);
    a.notify();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('picks up a dispatcher that appears later', () => {
    const onChange = vi.fn();
    const a = fakeDispatcher();
    const b = fakeDispatcher();
    const watch = dispatcherWatch(onChange);
    watch.sync([a.dispatcher]);
    watch.sync([a.dispatcher, b.dispatcher]);
    b.notify();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('lets go of a dispatcher that is no longer live', () => {
    const a = fakeDispatcher();
    const b = fakeDispatcher();
    const watch = dispatcherWatch(vi.fn());
    watch.sync([a.dispatcher, b.dispatcher]);
    watch.sync([a.dispatcher]);
    expect(b.listeners.size).toBe(0);
    expect(a.listeners.size).toBe(1);
  });

  it('lets go of every dispatcher on stop', () => {
    const a = fakeDispatcher();
    const watch = dispatcherWatch(vi.fn());
    watch.sync([a.dispatcher]);
    watch.stop();
    expect(a.listeners.size).toBe(0);
  });
});
