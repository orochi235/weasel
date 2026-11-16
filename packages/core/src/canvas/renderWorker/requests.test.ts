import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequests } from './requests';

afterEach(() => { vi.useRealTimers(); });

describe('createRequests', () => {
  it('waits out a timeout longer than one timer holds before answering missing', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const requests = createRequests<string>({ missing: () => 'missing', timeout: 2 ** 31, onTimeout });
    void requests.ask(() => {});
    vi.advanceTimersByTime(1);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(requests.size).toBe(1);
    vi.advanceTimersByTime(2 ** 31);
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(requests.size).toBe(0);
  });

  it('never times out on an infinite timeout', () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    const requests = createRequests<string>({ missing: () => 'missing', timeout: Infinity, onTimeout });
    void requests.ask(() => {});
    vi.advanceTimersByTime(2 ** 40);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(requests.size).toBe(1);
  });
});
