import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createScene, decodeSnapshot, isSerializedScene, type SavedScene } from '@weasel-js/core';
import { createIndexedDbAdapter, openRecords } from '@weasel-js/storage';
import { readStored } from './sessionStore';
import { nodeSpecsFromSnapshot } from './snapshot';
import { useSessionPersistence } from './useSessionPersistence';

type Data = { photo: string; coords: Float32Array };
type Pose = { x: number; y: number; width: number; height: number };
const POSE: Pose = { x: 0, y: 0, width: 10, height: 10 };
const KEYS = { sceneKey: 'scene', historyKey: 'history' } as const;

let n = 0;
const openSession = (database: string) =>
  openRecords({ storage: createIndexedDbAdapter({ database }), prefix: 'app:' });
const newScene = (initial = nodeSpecsFromSnapshot<Data, 'main', Pose>({ version: 3, systemLayers: [{ id: 'main' }], nodes: [] })) =>
  createScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }], initial });

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useSessionPersistence over IndexedDB', () => {
  it('keeps a scene too big for localStorage, and its undo stack, and reads them back after a reload', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const database = `session-${n++}`;
    // Past localStorage's quota, as a few embedded photos are.
    const photo = `data:image/png;base64,${'A'.repeat(6_000_000)}`;
    const records = await openSession(database);
    const scene = newScene();
    const onSaved = vi.fn();
    const local = vi.fn();
    const session = renderHook(() => useSessionPersistence(scene, { ...KEYS, records, onSaved, debounceMs: 0 }));
    const inLocalStorage = renderHook(() =>
      useSessionPersistence(scene, { sceneKey: 'local:scene', historyKey: 'local:history', onSaved: local, debounceMs: 0 }));
    act(() => { scene.add({ kind: 'mark', layer: 'main', pose: POSE, data: { photo, coords: new Float32Array([1, 2]) } }); });
    session.rerender();
    inLocalStorage.rerender();
    await vi.waitFor(() => expect(onSaved).toHaveBeenLastCalledWith(true));
    await vi.waitFor(() => expect(local).toHaveBeenLastCalledWith(false));
    session.unmount();
    inLocalStorage.unmount();
    expect(await records.close()).toBe(true);
    expect(localStorage.getItem('local:scene')).toBeNull();

    const reopened = await openSession(database);
    const specs = readStored('scene', (json) => {
      const saved = decodeSnapshot(json);
      if (!isSerializedScene<Data, 'main', Pose>(saved)) throw new Error('not a scene');
      return nodeSpecsFromSnapshot(saved as SavedScene<Data, 'main', Pose>);
    }, () => [], reopened);
    const next = newScene(specs);
    renderHook(() => useSessionPersistence(next, { ...KEYS, records: reopened }));
    const [node] = [...next.nodes.values()];
    expect(node?.data.photo).toBe(photo);
    expect(node?.data.coords).toEqual(new Float32Array([1, 2]));
    expect(next.canUndo()).toBe(true);
    await reopened.close();
  }, 30_000);
});
