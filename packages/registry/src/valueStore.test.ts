import { describe, expect, it, vi } from 'vitest';
import { createValueStore } from './valueStore';
import { sameList } from './sameList';

describe('createValueStore', () => {
  it('reads a rebuilt list holding a NaN as no change under sameList, as its default reads a NaN', () => {
    const store = createValueStore([NaN, 1], sameList);
    const heard = vi.fn();
    store.subscribe(heard);
    store.set([NaN, 1]);
    expect(heard).not.toHaveBeenCalled();
  });
});
