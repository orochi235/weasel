import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DOC_KEY } from './docPersistence';
import { drawScene } from './testScenes';
import { useSessionPersistence } from './useSessionPersistence';

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("draw's useSessionPersistence", () => {
  it('lets go of the paper size and background an older drawing kept beside it once the scene holding them is saved', () => {
    vi.useFakeTimers();
    localStorage.setItem(DOC_KEY, JSON.stringify({ filename: 'a.svg', paperSize: 'a4', backgroundColor: '#ff0000' }));
    renderHook(() => useSessionPersistence(drawScene()));
    expect(JSON.parse(localStorage.getItem(DOC_KEY)!)).toMatchObject({ paperSize: 'a4' });
    act(() => { vi.advanceTimersByTime(300); });
    expect(JSON.parse(localStorage.getItem(DOC_KEY)!)).toEqual({ filename: 'a.svg' });
  });
});
