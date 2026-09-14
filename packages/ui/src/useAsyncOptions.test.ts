import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useAsyncOptions } from './useAsyncOptions';

/** A promise plus the handles to settle it, so a test can order two responses. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const RED = { value: 'r', label: 'Red' };
const BLUE = { value: 'b', label: 'Blue' };

describe('useAsyncOptions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call load until the debounce elapses', async () => {
    const load = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useAsyncOptions({ load, debounceMs: 150 }));

    act(() => result.current.onInputChange('re'));
    act(() => void vi.advanceTimersByTime(149));
    expect(load).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1));
    expect(load).toHaveBeenCalledWith('re', expect.any(AbortSignal));
  });

  it('coalesces keystrokes inside the debounce window into one call', async () => {
    const load = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useAsyncOptions({ load, debounceMs: 150 }));

    act(() => result.current.onInputChange('r'));
    act(() => void vi.advanceTimersByTime(100));
    act(() => result.current.onInputChange('re'));
    act(() => void vi.advanceTimersByTime(100));
    act(() => result.current.onInputChange('red'));
    act(() => void vi.advanceTimersByTime(150));

    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('red', expect.any(AbortSignal));
  });

  it('discards a superseded response that resolves after its successor', async () => {
    // The case a `live` boolean misses: both requests are in flight, so neither
    // has had its cleanup run, and the slower first one lands last.
    const first = deferred<typeof RED[]>();
    const second = deferred<typeof BLUE[]>();
    const load = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useAsyncOptions({ load, debounceMs: 0 }));

    act(() => result.current.onInputChange('r'));
    act(() => void vi.advanceTimersByTime(1));
    act(() => result.current.onInputChange('b'));
    act(() => void vi.advanceTimersByTime(1));
    expect(load).toHaveBeenCalledTimes(2);

    await act(async () => {
      second.resolve([BLUE]);
      await second.promise;
    });
    expect(result.current.options).toEqual([BLUE]);

    await act(async () => {
      first.resolve([RED]);
      await first.promise;
    });
    expect(result.current.options).toEqual([BLUE]);
  });

  it('aborts a superseded request rather than only ignoring it', async () => {
    const signals: AbortSignal[] = [];
    const load = vi.fn((_q: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<never>(() => {});
    });
    const { result } = renderHook(() => useAsyncOptions({ load, debounceMs: 0 }));

    act(() => result.current.onInputChange('r'));
    act(() => void vi.advanceTimersByTime(1));
    act(() => result.current.onInputChange('re'));
    act(() => void vi.advanceTimersByTime(1));

    expect(signals).toHaveLength(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it('reports a rejected load and keeps the options already on screen', async () => {
    const first = deferred<typeof RED[]>();
    const second = deferred<never>();
    const load = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useAsyncOptions({ load, debounceMs: 0 }));

    act(() => result.current.onInputChange('r'));
    act(() => void vi.advanceTimersByTime(1));
    await act(async () => {
      first.resolve([RED]);
      await first.promise;
    });
    expect(result.current.options).toEqual([RED]);

    act(() => result.current.onInputChange('rx'));
    act(() => void vi.advanceTimersByTime(1));
    await act(async () => {
      second.reject(new Error('offline'));
      await second.promise.catch(() => {});
    });

    await waitFor(() => expect(result.current.loadError).toBeInstanceOf(Error));
    expect(result.current.options).toEqual([RED]);
    expect(result.current.isLoading).toBe(false);
  });

  it('clears a previous error once a later load succeeds', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([BLUE]);
    const { result } = renderHook(() => useAsyncOptions({ load, debounceMs: 0 }));

    act(() => result.current.onInputChange('r'));
    await act(async () => void vi.advanceTimersByTime(1));
    await waitFor(() => expect(result.current.loadError).toBeInstanceOf(Error));

    act(() => result.current.onInputChange('b'));
    await act(async () => void vi.advanceTimersByTime(1));
    await waitFor(() => expect(result.current.options).toEqual([BLUE]));
    expect(result.current.loadError).toBeNull();
  });

  it('holds isLoading from the call until the response lands', async () => {
    const first = deferred<typeof RED[]>();
    const load = vi.fn().mockReturnValueOnce(first.promise);
    const { result } = renderHook(() => useAsyncOptions({ load, debounceMs: 0 }));

    expect(result.current.isLoading).toBe(false);
    act(() => result.current.onInputChange('r'));
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      first.resolve([RED]);
      await first.promise;
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('does not call load below minLength, and empties the options', async () => {
    const load = vi.fn().mockResolvedValue([RED]);
    const { result } = renderHook(() =>
      useAsyncOptions({ load, debounceMs: 0, minLength: 2 }),
    );

    act(() => result.current.onInputChange('re'));
    await act(async () => void vi.advanceTimersByTime(1));
    await waitFor(() => expect(result.current.options).toEqual([RED]));

    act(() => result.current.onInputChange('r'));
    act(() => void vi.advanceTimersByTime(1));
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.options).toEqual([]);
  });

  it('calls load with the empty string when minLength is 0', async () => {
    const load = vi.fn().mockResolvedValue([RED, BLUE]);
    const { result } = renderHook(() => useAsyncOptions({ load, debounceMs: 0 }));

    act(() => result.current.onInputChange(''));
    await act(async () => void vi.advanceTimersByTime(1));
    expect(load).toHaveBeenCalledWith('', expect.any(AbortSignal));
  });

  it('reads the latest load without restarting on an inline function', async () => {
    // A consumer passing `load={(q) => client.search(q)}` re-creates it every
    // render; that must not re-fire the request.
    const load = vi.fn().mockResolvedValue([]);
    const { result, rerender } = renderHook(() =>
      useAsyncOptions({ load: (q: string, s: AbortSignal) => load(q, s), debounceMs: 0 }),
    );

    act(() => result.current.onInputChange('r'));
    await act(async () => void vi.advanceTimersByTime(1));
    expect(load).toHaveBeenCalledTimes(1);

    rerender();
    await act(async () => void vi.advanceTimersByTime(10));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('tracks the input value it was given', () => {
    const load = vi.fn().mockResolvedValue([]);
    const { result } = renderHook(() => useAsyncOptions({ load, debounceMs: 0 }));

    expect(result.current.inputValue).toBe('');
    act(() => result.current.onInputChange('re'));
    expect(result.current.inputValue).toBe('re');
  });
});
