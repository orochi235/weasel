import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { HistoryRestoreError, IDENTITY_POSE_COMPOSITION, SCENE_HISTORY_FORM, createScene } from '@weasel-js/core';
import { savedAtOf, useSessionPersistence, type SessionPersistenceOptions } from './useSessionPersistence';

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('useSessionPersistence', () => {
  it('saves the scene with no onSaved to report to', async () => {
    vi.useFakeTimers();
    const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    renderHook(() => useSessionPersistence(scene, { sceneKey: 'test:scene', historyKey: 'test:history' }));
    await vi.advanceTimersByTimeAsync(300);
    expect(JSON.parse(localStorage.getItem('test:scene')!)).toMatchObject({ version: 3, nodes: [] });
    expect(localStorage.getItem('test:history')).not.toBeNull();
  });

  it('stamps the saved scene with when it was saved', async () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    renderHook(() => useSessionPersistence(scene, { sceneKey: 'test:scene', historyKey: 'test:history' }));
    await vi.advanceTimersByTimeAsync(300);
    expect(savedAtOf(JSON.parse(localStorage.getItem('test:scene')!))).toBe(1_700_000_000_300);
    expect(savedAtOf({ version: 3, nodes: [] })).toBeUndefined();
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

  describe('a saved undo stack naming an op this build cannot replay', () => {
    const entry = { id: 1, label: 'gone', forwardOps: [{ name: 'app:gone', args: {} }], baseOps: [{ name: 'app:gone', args: {} }] };
    const stack = { version: 1, form: SCENE_HISTORY_FORM, undoStack: [entry], redoStack: [], nextEntryId: 2, droppedEntries: 0 };
    const mount = (opts: Partial<SessionPersistenceOptions>) => {
      localStorage.setItem('test:scene', JSON.stringify({ version: 3, systemLayers: [{ id: 'main' }], nodes: [] }));
      localStorage.setItem('test:history', JSON.stringify(stack));
      const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
      const outcomes: unknown[] = [];
      renderHook(() => useSessionPersistence(scene, {
        sceneKey: 'test:scene', historyKey: 'test:history', onHistoryRestore: (o) => outcomes.push(o), ...opts,
      }));
      return { scene, outcomes };
    };

    it('is dropped under strict recovery, and the error reported', () => {
      const { scene, outcomes } = mount({});
      expect(scene.canUndo()).toBe(false);
      expect(localStorage.getItem('test:history')).toBeNull();
      expect(outcomes).toEqual([{ error: expect.any(HistoryRestoreError) }]);
    });

    it('keeps its entries under best-effort recovery, and reports what it could not rebuild', () => {
      const { scene, outcomes } = mount({ historyRecovery: 'best-effort' });
      expect(scene.canUndo()).toBe(true);
      expect(outcomes).toEqual([{ report: { restored: true, unresolved: [expect.objectContaining({ name: 'app:gone', reason: 'unknown' })] } }]);
    });
  });

  it('drops a saved undo stack beside a scene its load kept aside as unreadable', () => {
    const saved = JSON.stringify({ version: 3, systemLayers: [{ id: 'main' }], nodes: [] });
    localStorage.setItem('test:scene', saved);
    localStorage.setItem('test:scene:unreadable', saved);
    localStorage.setItem('test:history', '{"version":1}');
    const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    const restore = vi.spyOn(scene, 'restoreHistory');
    renderHook(() => useSessionPersistence(scene, { sceneKey: 'test:scene', historyKey: 'test:history' }));
    expect(restore).not.toHaveBeenCalled();
    expect(localStorage.getItem('test:history')).toBeNull();
  });
});
