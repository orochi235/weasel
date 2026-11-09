import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { IDENTITY_POSE_COMPOSITION, createScene } from '@weasel-js/core';
import { useSessionPersistence } from './useSessionPersistence';

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('useSessionPersistence', () => {
  it('saves the scene with no onSaved to report to', () => {
    vi.useFakeTimers();
    const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    renderHook(() => useSessionPersistence(scene, { sceneKey: 'test:scene', historyKey: 'test:history' }));
    vi.advanceTimersByTime(300);
    expect(JSON.parse(localStorage.getItem('test:scene')!)).toMatchObject({ version: 3, nodes: [] });
    expect(localStorage.getItem('test:history')).not.toBeNull();
  });

  it('saves a pending change when it unmounts before the delay', () => {
    vi.useFakeTimers();
    const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    const { unmount } = renderHook(() => useSessionPersistence(scene, { sceneKey: 'test:scene', historyKey: 'test:history' }));
    vi.advanceTimersByTime(100);
    expect(localStorage.getItem('test:scene')).toBeNull();
    unmount();
    expect(JSON.parse(localStorage.getItem('test:scene')!)).toMatchObject({ version: 3, nodes: [] });
  });

  it('drops a saved undo stack recorded while the pages were a core:pages value', () => {
    localStorage.setItem('test:scene', JSON.stringify({ version: 3, systemLayers: [{ id: 'main' }], nodes: [], doc: { 'core:pages': { pages: [] } } }));
    localStorage.setItem('test:history', '{"not":"read"}');
    const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    const restore = vi.spyOn(scene, 'restoreHistory');
    renderHook(() => useSessionPersistence(scene, { sceneKey: 'test:scene', historyKey: 'test:history' }));
    expect(restore).not.toHaveBeenCalled();
    expect(localStorage.getItem('test:history')).toBeNull();
  });

  it('drops a saved undo stack when the scene beside it is missing, unparseable, or not a saved scene', () => {
    for (const saved of [null, '{"version":3,"nodes":[', '{"not":"a scene"}']) {
      localStorage.clear();
      if (saved !== null) localStorage.setItem('test:scene', saved);
      localStorage.setItem('test:history', '{"version":1}');
      const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
      const restore = vi.spyOn(scene, 'restoreHistory');
      const { unmount } = renderHook(() => useSessionPersistence(scene, { sceneKey: 'test:scene', historyKey: 'test:history' }));
      expect(restore).not.toHaveBeenCalled();
      expect(localStorage.getItem('test:history')).toBeNull();
      unmount();
    }
  });
});
