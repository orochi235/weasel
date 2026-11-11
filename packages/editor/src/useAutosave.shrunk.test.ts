import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutosave } from './useAutosave';

afterEach(() => { vi.useRealTimers(); localStorage.clear(); });

describe('shrunk from the autosave property', () => {
  it('waits out a delay longer than one timer holds', () => {
    vi.useFakeTimers();
    const writes: string[] = [];
    renderHook(() => useAutosave(() => { writes.push('a'); return { primary: ['doc', 'a'] }; }, { delayMs: 2 ** 31 }));
    vi.advanceTimersByTime(1);
    expect(writes).toEqual([]);
    vi.advanceTimersByTime(2 ** 31);
    expect(writes).toEqual(['a']);
  });
});
