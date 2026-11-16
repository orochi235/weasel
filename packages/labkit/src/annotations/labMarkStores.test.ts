import { describe, expect, it, vi } from 'vitest';
import { createLabMarkStores } from './labMarkStores';
import type { AnnotationsApi } from './types';

const fakeStore = () => ({ subscribe: vi.fn(() => () => {}) }) as unknown as AnnotationsApi;

describe('createLabMarkStores', () => {
  it('stacks stores registered under one trial id, newest live, whichever is released first', () => {
    const registry = createLabMarkStores();
    const first = fakeStore();
    const second = fakeStore();
    const releaseFirst = registry.register('t', first);
    const releaseSecond = registry.register('t', second);
    expect(registry.list()).toEqual([second]);

    releaseSecond();
    expect(registry.list()).toEqual([first]);

    const third = fakeStore();
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
    registry.register('t', fakeStore());
    expect(off).not.toHaveBeenCalled();
    release();
    release();
    expect(off).toHaveBeenCalledTimes(1);
  });
});
