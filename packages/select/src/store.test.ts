import { describe, expect, it, vi } from 'vitest';
import { createSelectionStore } from './store';

describe('createSelectionStore', () => {
  it('starts at what it is given and reads back what is set', () => {
    const store = createSelectionStore(['a']);
    expect(store.getSelection()).toEqual(['a']);
    store.setSelection(['b', 'c']);
    expect(store.getSelection()).toEqual(['b', 'c']);
  });

  it('notifies subscribers on every set until they unsubscribe', () => {
    const store = createSelectionStore<string>();
    const listener = vi.fn();
    const stop = store.subscribe(listener);
    store.setSelection(['a']);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    store.setSelection(['b']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is readable from inside a listener, already holding the new value', () => {
    const store = createSelectionStore<string>();
    let seen: readonly string[] = [];
    store.subscribe(() => { seen = store.getSelection(); });
    store.setSelection(['x']);
    expect(seen).toEqual(['x']);
  });

  it('runs every listener past one that throws, and does not throw into the setter', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const store = createSelectionStore<string>();
    const after = vi.fn();
    store.subscribe(() => { throw new Error('boom'); });
    store.subscribe(after);
    expect(() => store.setSelection(['a'])).not.toThrow();
    expect(after).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
