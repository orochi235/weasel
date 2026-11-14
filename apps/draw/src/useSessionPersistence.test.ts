import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { asNodeId, createScene, type AddNodeSpec } from '@weasel-js/core';
import { DOC_KEY, loadDoc } from './docPersistence';
import { DRAW_LAYERS, DRAW_REGISTRY, type DrawScene, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import { closeSession, openSession } from './openSession';
import { loadInitial, loadSceneHistory, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';
import { sessionRecords } from './sessionRecords';
import { drawScene } from './testScenes';
import { useSessionPersistence } from './useSessionPersistence';

afterEach(async () => {
  await closeSession();
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

let databases = 0;
const nextDatabase = () => `weaseldraw-test-${databases++}`;

/** A scene made from the session, as draw makes its own. */
const loadedScene = (): DrawScene =>
  createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: DRAW_LAYERS, registry: DRAW_REGISTRY, initial: loadInitial() });

/** A mark filled with a picture, `src` its data URL. */
const pictureMark = (id: string, src: string): AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose> => ({
  id: asNodeId(id), kind: 'mark', layer: 'default' as WeaselDrawLayer, pose: { x: 0, y: 0, width: 64, height: 32 },
  data: { fill: { paint: { kind: 'image', src, width: 64, height: 32, units: 'bounds' } } },
});

const pictureOf = (id: string): unknown => {
  const spec = loadInitial().find((s) => s.id === id);
  const fill = spec?.data.fill;
  const paint = fill && fill !== 'inherit' ? fill.paint : undefined;
  return paint?.kind === 'image' ? paint.src : undefined;
};

/** Run draw's session hook over a scene made from the session, add `node`, and unmount, which saves at once. */
async function saveWith(node: AddNodeSpec<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>, landed: () => boolean): Promise<void> {
  const scene = loadedScene();
  const { rerender, unmount } = renderHook(() => useSessionPersistence(scene));
  act(() => { scene.add(node); });
  rerender();
  unmount();
  await vi.waitFor(() => expect(landed()).toBe(true), { timeout: 10_000 });
}

const landedIn = (keys: readonly string[]) => () => {
  const records = sessionRecords();
  return !!records && keys.every((k) => records.has(k) && !records.pending(k));
};
const inLocalStorage = (keys: readonly string[]) => () => keys.every((k) => localStorage.getItem(k) !== null);

describe("draw's useSessionPersistence", () => {
  it('lets go of the paper size and background an older drawing kept beside it once the scene holding them is saved', async () => {
    vi.useFakeTimers();
    localStorage.setItem(DOC_KEY, JSON.stringify({ filename: 'a.svg', paperSize: 'a4', backgroundColor: '#ff0000' }));
    renderHook(() => useSessionPersistence(drawScene()));
    expect(JSON.parse(localStorage.getItem(DOC_KEY)!)).toMatchObject({ paperSize: 'a4' });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(JSON.parse(localStorage.getItem(DOC_KEY)!)).toEqual({ filename: 'a.svg' });
  });
});

describe("draw's session in IndexedDB", () => {
  it('keeps a drawing too big for localStorage, and its undo stack, and reads them back after a reload', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const database = nextDatabase();
    // Past localStorage's quota, as a few embedded photos are.
    const photo = `data:image/png;base64,${'A'.repeat(6_000_000)}`;
    await openSession(database);
    await saveWith(pictureMark('photo', photo), landedIn([LS_KEY, SCENE_HISTORY_KEY]));
    await closeSession();
    expect(localStorage.getItem(LS_KEY)).toBeNull();

    await openSession(database);
    expect(pictureOf('photo')).toBe(photo);
    expect(loadSceneHistory()).not.toBeNull();
  }, 30_000);

  it('moves a session from localStorage on its first open, clears it there once moved, and never moves one again', async () => {
    const database = nextDatabase();
    await saveWith(pictureMark('m', 'data:image/png;base64,iVBORw0KGgo='), inLocalStorage([LS_KEY, SCENE_HISTORY_KEY]));
    localStorage.setItem(DOC_KEY, JSON.stringify({ filename: 'moved.svg' }));

    await openSession(database);
    expect([LS_KEY, SCENE_HISTORY_KEY, DOC_KEY].map((k) => localStorage.getItem(k))).toEqual([null, null, null]);
    expect(pictureOf('m')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(loadSceneHistory()).not.toBeNull();
    expect(loadDoc().filename).toBe('moved.svg');
    await vi.waitFor(() => expect(landedIn([LS_KEY, SCENE_HISTORY_KEY, DOC_KEY])()).toBe(true));
    await closeSession();

    localStorage.setItem(DOC_KEY, JSON.stringify({ filename: 'stale.svg' }));
    await openSession(database);
    expect(loadDoc().filename).toBe('moved.svg');
    expect(pictureOf('m')).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(JSON.parse(localStorage.getItem(DOC_KEY)!)).toEqual({ filename: 'stale.svg' });
  }, 30_000);
});
