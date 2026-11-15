import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import {
  IDENTITY_POSE_COMPOSITION, createScene, parseSnapshot, type AddNodeSpec, type SavedScene,
} from '@weasel-js/core';
import { nodeSpecsFromSnapshot } from './snapshot';
import { savedAtOf, useSessionPersistence } from './useSessionPersistence';

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

  it('restores a saved undo stack onto the scene it was saved beside, and drops it from any other', async () => {
    vi.useFakeTimers();
    const box = { x: 0, y: 0, width: 1, height: 1 };
    const make = (specs = [] as AddNodeSpec<unknown, 'main', unknown>[]) =>
      createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }], initial: specs });
    const scene = make();
    const first = renderHook(() => useSessionPersistence(scene, { sceneKey: 'test:scene', historyKey: 'test:history' }));
    act(() => { scene.add({ kind: 'mark', layer: 'main', pose: box, data: {} }); });
    first.rerender();
    await vi.advanceTimersByTimeAsync(300);
    first.unmount();
    const saved = parseSnapshot(localStorage.getItem('test:scene')!) as SavedScene<unknown, 'main', unknown>;
    const history = localStorage.getItem('test:history');

    const reloaded = make(nodeSpecsFromSnapshot(saved));
    renderHook(() => useSessionPersistence(reloaded, { sceneKey: 'test:scene', historyKey: 'test:history' })).unmount();
    expect(reloaded.canUndo()).toBe(true);

    localStorage.setItem('test:history', history!);
    const other = make();
    renderHook(() => useSessionPersistence(other, { sceneKey: 'test:scene', historyKey: 'test:history' }));
    expect(other.canUndo()).toBe(false);
    expect(localStorage.getItem('test:history')).toBeNull();
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
