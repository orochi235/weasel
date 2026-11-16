import { describe, expect, it, vi } from 'vitest';
import { createLabMarkStores } from './labMarkStores';
import type { AnnotationsApi } from './types';

function fakeStore(): AnnotationsApi & { poke(): void } {
  const listeners = new Set<() => void>();
  return {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    poke: () => {
      for (const fn of listeners) fn();
    },
  } as unknown as AnnotationsApi & { poke(): void };
}

describe('createLabMarkStores', () => {
  it('lists each trial once, a second store for a trial replacing the first, and reflects them by trial id', () => {
    const reg = createLabMarkStores();
    const a = fakeStore();
    const b = fakeStore();
    const c = fakeStore();
    reg.register('t1', a);
    reg.register('t2', b);
    reg.register('t1', c);
    expect(reg.list()).toEqual([c, b]);
    expect(reg.reflection.entries().map((e) => [e.key, e.value, e.shadowed.length])).toEqual([
      ['t1', c, 0],
      ['t2', b, 0],
    ]);
  });

  it('notifies after the list changes, and leaves a newer store alone when a stale release runs', () => {
    const reg = createLabMarkStores();
    const a = fakeStore();
    const b = fakeStore();
    const seen: number[] = [];
    reg.subscribe(() => seen.push(reg.list().length));
    const offA = reg.register('t1', a);
    reg.register('t1', b);
    offA();
    expect(reg.list()).toEqual([b]);
    expect(seen).toEqual([1, 1]);
  });

  it("forwards a store's own changes, keeping the list's identity", () => {
    const reg = createLabMarkStores();
    const a = fakeStore();
    const off = reg.register('t1', a);
    const list = reg.list();
    const listener = vi.fn();
    reg.subscribe(listener);
    const before = reg.version();
    a.poke();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(reg.version()).toBe(before + 1);
    expect(reg.list()).toBe(list);
    off();
    a.poke();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(reg.list()).toEqual([]);
  });
});
