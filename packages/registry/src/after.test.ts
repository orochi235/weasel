import { afterEach, describe, expect, it, vi } from 'vitest';
import { after } from './after';

afterEach(() => { vi.useRealTimers(); });

describe('after', () => {
  it('waits out a delay longer than one timer holds, and can be canceled partway', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    after(2 ** 32, fn);
    vi.advanceTimersByTime(2 ** 32 - 1);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    const kept = vi.fn();
    const cancel = after(2 ** 32, kept);
    vi.advanceTimersByTime(2 ** 31);
    cancel();
    vi.advanceTimersByTime(2 ** 33);
    expect(kept).not.toHaveBeenCalled();
  });

  it('never runs for an infinite delay', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    after(Infinity, fn);
    vi.advanceTimersByTime(2 ** 40);
    expect(fn).not.toHaveBeenCalled();
  });
});
