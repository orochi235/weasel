import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRigEditState } from './rigEditState';

afterEach(() => vi.restoreAllMocks());

describe('createRigEditState', () => {
  it('tells every listener when the active joint changes, and not when it is set to itself', () => {
    const state = createRigEditState();
    const heard = vi.fn();
    state.listen(heard);
    state.setActive('hip');
    state.setActive('hip');
    expect(heard).toHaveBeenCalledTimes(1);
    expect(state.active()).toBe('hip');
  });

  it('still tells the listeners after one that throws', () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const state = createRigEditState();
    const heard = vi.fn();
    state.listen(() => { throw new Error('boom'); });
    state.listen(heard);
    expect(() => state.setActive('hip')).not.toThrow();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalledTimes(1);
  });
});
