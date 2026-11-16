import { describe, expect, it, vi } from 'vitest';
import { createCompletions } from './completions';

describe('createCompletions', () => {
  it('tells every watch of an id once, even past one that throws', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = createCompletions(() => true);
    const after = vi.fn();
    c.watch(1, () => { throw new Error('boom'); });
    c.watch(1, after);
    c.fire(1);
    c.fire(1);
    expect(after).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it('skips a watch stopped by an earlier one in the same pass', () => {
    const c = createCompletions(() => true);
    const second = vi.fn();
    let stopSecond = () => {};
    c.watch(1, () => stopSecond());
    stopSecond = c.watch(1, second);
    c.fire(1);
    expect(second).not.toHaveBeenCalled();
  });
});
