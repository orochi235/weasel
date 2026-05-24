// Scene-snapshot persistence — IndexedDB, separate from the prefs layer.
//
// Prefs live in localStorage (they're small, scalar-ish, frequently read).
// The scene snapshot is a richer object graph that can include typed arrays
// (`PolygonPath` carries Float32Array / Uint8Array). IDB's structured-clone
// serialization handles that natively, so we never serialize to JSON.
//
// The store holds a single record under the well-known key `'current'`. We
// never grow the keyspace today; future "recent files" would justify a v2.

import type { Group, SerializedHistory } from '@orochi235/weasel';
import type { Obj } from './poseUpdate';

/** Per-document metadata. Mirrors the local interface in App.tsx; kept here
 *  so the store has a self-contained shape and isn't tied to App's render
 *  tree. */
export interface Document {
  size: { width: number; height: number };
}

export interface View {
  x: number;
  y: number;
  scale: { x: number; y: number };
}

export interface SceneSnapshot {
  version: 1;
  items: Obj[];
  groups: Group[];
  doc: Document;
  view: View;
  /** Optional — older snapshots predate selection persistence and load with
   *  an empty selection. New snapshots always include it. */
  selection?: string[];
  /** Optional — older snapshots predate history persistence. When absent the
   *  reload starts with an empty undo stack (the pre-feature behavior). */
  history?: SerializedHistory;
}

export const DB_NAME = 'weaseldraw';
export const DB_VERSION = 1;
export const STORE_NAME = 'scene';
export const SCENE_KEY = 'current';

/** Resolves the global `indexedDB` factory, or null when running in a
 *  context that lacks it (SSR, private mode with IDB disabled, tests
 *  without a shim). */
function getIDB(): IDBFactory | null {
  try {
    if (typeof indexedDB !== 'undefined') return indexedDB;
    if (typeof globalThis !== 'undefined' && (globalThis as { indexedDB?: IDBFactory }).indexedDB) {
      return (globalThis as { indexedDB?: IDBFactory }).indexedDB!;
    }
  } catch {
    /* ignored */
  }
  return null;
}

/** Wrap an IDBRequest in a promise. Resolves with `result`, rejects with
 *  the request's error. */
function reqPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function openDb(): Promise<IDBDatabase> {
  const idb = getIDB();
  if (!idb) throw new Error('IndexedDB unavailable');
  return new Promise<IDBDatabase>((resolve, reject) => {
    const req = idb.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });
}

/** Best-effort load. Returns null when IDB is unavailable, when no record
 *  exists, when the record fails structured-clone read, or when its version
 *  doesn't match the current shape. */
export async function loadScene(): Promise<SceneSnapshot | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const raw = await reqPromise(store.get(SCENE_KEY));
      if (raw == null || typeof raw !== 'object') return null;
      const snap = raw as Partial<SceneSnapshot>;
      if (snap.version !== 1) return null;
      if (!Array.isArray(snap.items) || !Array.isArray(snap.groups)) return null;
      if (!snap.doc || !snap.view) return null;
      // Migrate legacy `view.scale: number` snapshots to the per-axis shape.
      const v = snap.view as unknown as { x: number; y: number; scale: number | { x: number; y: number } };
      if (typeof v.scale === 'number') {
        snap.view = { x: v.x, y: v.y, scale: { x: v.scale, y: v.scale } };
      }
      return snap as SceneSnapshot;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Best-effort save. Swallows all errors so the UI never breaks on a
 *  full / locked / unavailable IDB. */
export async function saveScene(snapshot: SceneSnapshot): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(snapshot, SCENE_KEY);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    /* ignored — persistence is best-effort */
  }
}

export async function clearScene(): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(SCENE_KEY);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  } catch {
    /* ignored */
  }
}
