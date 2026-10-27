import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPointerStore } from './ambient/PointerContext';
import { createLongPressStore, type PendingLongPress } from './interactions/dispatcher/longPressState';
import { createDepRegistry } from './index';

afterEach(() => vi.restoreAllMocks());

/** Subscribes one listener that throws and one after it, and says what `change` did to them. */
function afterAThrow(subscribe: (fn: () => void) => unknown, change: () => void) {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const heard = vi.fn();
  subscribe(() => { throw new Error('boom'); });
  subscribe(heard);
  expect(change).not.toThrow();
  expect(heard).toHaveBeenCalledTimes(1);
  expect(logged).toHaveBeenCalledTimes(1);
}

describe('a subscriber that throws does not stop the ones after it', () => {
  it('in a pointer store', () => {
    const store = createPointerStore();
    afterAThrow(store.subscribe, () => store.set({ world: { x: 1, y: 2 }, viewId: null }));
  });

  it('in a long-press store', () => {
    const store = createLongPressStore();
    afterAThrow(store.subscribe, () => store.set({ pointerId: 1 } as PendingLongPress));
  });
});

describe('a dep registry', () => {
  it('leaves a subscriber added during a notify for the next one', () => {
    const deps = createDepRegistry();
    const late = vi.fn();
    let added = false;
    deps.subscribe?.(() => {
      if (added) return;
      added = true;
      deps.subscribe?.(late);
    });
    deps.changed?.();
    expect(late).not.toHaveBeenCalled();
    deps.changed?.();
    expect(late).toHaveBeenCalledTimes(1);
  });
});
