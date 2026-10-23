import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createScene } from '@weasel-js/core';
import { useSessionPersistence } from './useSessionPersistence';

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('useSessionPersistence', () => {
  it('saves the scene with no onSaved to report to', () => {
    vi.useFakeTimers();
    const scene = createScene<unknown, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
    renderHook(() => useSessionPersistence(scene, { sceneKey: 'test:scene', historyKey: 'test:history' }));
    vi.advanceTimersByTime(300);
    expect(JSON.parse(localStorage.getItem('test:scene')!)).toMatchObject({ version: 2, nodes: [] });
    expect(localStorage.getItem('test:history')).not.toBeNull();
  });

  it('saves a pending change when it unmounts before the delay', () => {
    vi.useFakeTimers();
    const scene = createScene<unknown, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
    const { unmount } = renderHook(() => useSessionPersistence(scene, { sceneKey: 'test:scene', historyKey: 'test:history' }));
    vi.advanceTimersByTime(100);
    expect(localStorage.getItem('test:scene')).toBeNull();
    unmount();
    expect(JSON.parse(localStorage.getItem('test:scene')!)).toMatchObject({ version: 2, nodes: [] });
  });
});
