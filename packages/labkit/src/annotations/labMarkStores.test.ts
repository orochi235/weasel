import { describe, expect, it, onTestFinished, vi } from 'vitest';
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

const quietStore = () => ({ subscribe: vi.fn(() => () => {}) }) as unknown as AnnotationsApi;

describe('createLabMarkStores', () => {
  it('lists each trial once, a second store for a trial shadowing the first, and reflects them by trial id', () => {
    const reg = createLabMarkStores();
    const a = fakeStore();
    const b = fakeStore();
    const c = fakeStore();
    reg.register('t1', a);
    reg.register('t2', b);
    reg.register('t1', c);
    expect(reg.list()).toEqual([c, b]);
    expect(reg.reflection.entries().map((e) => [e.key, e.value, e.shadowed.length])).toEqual([
      ['t1', c, 1],
      ['t2', b, 0],
    ]);
  });

  it('notifies after the list changes, and leaves a newer store live when an older one is released', () => {
    const reg = createLabMarkStores();
    const a = fakeStore();
    const b = fakeStore();
    const seen: number[] = [];
    reg.subscribe(() => seen.push(reg.list().length));
    const offA = reg.register('t1', a);
    reg.register('t1', b);
    offA();
    expect(reg.list()).toEqual([b]);
    expect(seen).toEqual([1, 1, 1]);
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

  it('stacks stores registered under one trial id, newest live, whichever is released first', () => {
    const registry = createLabMarkStores();
    const first = quietStore();
    const second = quietStore();
    const releaseFirst = registry.register('t', first);
    const releaseSecond = registry.register('t', second);
    expect(registry.list()).toEqual([second]);

    releaseSecond();
    expect(registry.list()).toEqual([first]);

    const third = quietStore();
    const releaseThird = registry.register('t', third);
    releaseFirst();
    expect(registry.list()).toEqual([third]);
    releaseThird();
    expect(registry.list()).toEqual([]);
  });

  it('unsubscribes from a store when its own release runs, and not before', () => {
    const registry = createLabMarkStores();
    const off = vi.fn();
    const first = { subscribe: vi.fn(() => off) } as unknown as AnnotationsApi;
    const release = registry.register('t', first);
    registry.register('t', quietStore());
    expect(off).not.toHaveBeenCalled();
    release();
    release();
    expect(off).toHaveBeenCalledTimes(1);
  });

  it('stacks a second store for a trial without a registry clash warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const registry = createLabMarkStores();
    registry.register('t', quietStore());
    registry.register('t', quietStore());
    expect(warn).not.toHaveBeenCalled();
  });
});
