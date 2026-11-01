import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNotifier } from './notifier';
import { createSceneSelection } from './sceneSelection';

afterEach(() => vi.restoreAllMocks());

describe('createNotifier', () => {
  it('still tells the subscribers after one that throws', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const notifier = createNotifier();
    const heard = vi.fn();
    notifier.subscribe(() => { throw new Error('boom'); });
    notifier.subscribe(heard);
    expect(() => notifier.notify()).not.toThrow();
    expect(() => notifier.deferred(() => notifier.notify())).not.toThrow();
    expect(heard).toHaveBeenCalledTimes(2);
    expect(logged).toHaveBeenCalledTimes(2);
  });

  it('leaves a subscriber added during a pass for the next one', () => {
    const notifier = createNotifier();
    const late = vi.fn();
    let added = false;
    notifier.subscribe(() => {
      if (added) return;
      added = true;
      notifier.subscribe(late);
    });
    notifier.notify();
    expect(late).not.toHaveBeenCalled();
    notifier.notify();
    expect(late).toHaveBeenCalledTimes(1);
  });
});

describe('createSceneSelection', () => {
  it('still tells the subscribers after one that throws', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const selection = createSceneSelection((ids) => ids, () => null);
    const heard = vi.fn();
    selection.subscribe(() => { throw new Error('boom'); });
    selection.subscribe(heard);
    expect(() => selection.set([])).not.toThrow();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledTimes(1);
  });
});
