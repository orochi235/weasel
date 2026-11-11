import { describe, expect, it, vi } from 'vitest';
import { createSelectionStore } from './store';

describe('createSelectionStore, shrunk', () => {
  it('tells no one when a write holds the NaN id it already held', () => {
    const store = createSelectionStore<number>([-0, NaN]);
    const heard = vi.fn();
    store.subscribe(heard);
    const before = store.getSelection();
    store.setSelection([0, NaN]);
    expect(heard).not.toHaveBeenCalled();
    expect(store.getSelection()).toBe(before);
  });
});
