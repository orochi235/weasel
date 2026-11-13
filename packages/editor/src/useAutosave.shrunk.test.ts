import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutosave } from './useAutosave';

afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

describe('shrunk from the autosave property', () => {
  it('waits out a delay longer than one timer holds', () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    renderHook(() => useAutosave(() => { writes.push('a'); return { primary: ['doc', 'a'] }; }, { debounceMs: 2 ** 31 }));
    vi.advanceTimersByTime(1);
    expect(writes).toEqual([]);
    vi.advanceTimersByTime(2 ** 31);
    expect(writes).toEqual(['a']);
  });

  it('writes a save flushed when the page went away once, not again when its timer runs', () => {
    vi.useFakeTimers();
    const onSaved = vi.fn();
    renderHook(() => useAutosave(() => ({ primary: ['doc', 'a'] }), { onSaved }));
    window.dispatchEvent(new Event('pagehide'));
    vi.advanceTimersByTime(300);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });
});
