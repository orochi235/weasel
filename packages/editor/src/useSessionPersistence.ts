import {
  defaultCommitAdapter, encodeSceneDocument, restorePairedHistory, type HistoryRecovery, type HistoryRestore, type Scene,
  useLatest,
} from '@weasel-js/core';
import type { RecordCache } from '@weasel-js/storage';
import { useEffect, useRef } from 'react';
import { readSlot, sessionSlots } from './sessionStore';
import { useAutosave } from './useAutosave';

/** Where `useSessionPersistence` keeps a scene and its undo stack, and what it reports after a save. */
export interface SessionPersistenceOptions {
  /** The key the scene is saved under. */
  sceneKey: string;
  /** The key the undo stack is saved under. */
  historyKey: string;
  /** Where the scene and its undo stack are kept, the keys their records' names: a cache opened before the scene is
   *  made, so its reads are ready. Defaults to `localStorage`, under the keys themselves. */
  records?: RecordCache;
  /** Read the saved undo stack, as `pairHistory` wrote it; defaults to the `historyKey` entry. Return null for none. */
  loadHistory?: () => unknown;
  /** How long after a change the save runs, as `useAutosave` takes it. Defaults to 300 ms. */
  debounceMs?: number;
  /** Called after every save attempt with whether the scene was written. */
  onSaved?: (ok: boolean) => void;
  /** How the saved undo stack is restored (`Scene.restoreHistory`'s `recovery`). Defaults to `'strict'`, under which
   *  a stack naming an op this build cannot replay is dropped whole. */
  historyRecovery?: HistoryRecovery;
  /** Called once a saved undo stack has been read: with how `restorePairedHistory` went (any status but
   *  `'restored'` drops the stack), or with `'failed'` and the error that dropped it. */
  onHistoryRestore?: (outcome: HistoryRestore | { status: 'failed'; error: unknown }) => void;
}

/** When the scene entry `value` was saved, in milliseconds since the epoch, as `useSessionPersistence` stamps each
 *  one under `savedAt`; `undefined` for an entry saved without a stamp, as every one was before 2026-11-14. Two copies
 *  of a session kept in different storage are told apart by it. */
export function savedAtOf(value: unknown): number | undefined {
  if (value === null || typeof value !== 'object') return undefined;
  const at = (value as { savedAt?: unknown }).savedAt;
  return typeof at === 'number' && Number.isFinite(at) ? at : undefined;
}

/**
 * Keeps a scene and its undo stack in storage, `localStorage` unless `opts.records` says otherwise: restores the stack once on mount,
 * then saves them through `useAutosave` after each render, both through core's `encodeSceneDocument`, the scene stamped with when it
 * was saved ({@link savedAtOf}) and the stack paired with it. A stack is restored only onto the state it was saved beside
 * (`restorePairedHistory`); one saved beside a scene that loaded otherwise, rebuilt, migrated, unreadable or replaced, is dropped.
 * The scene is read by the app, from the `sceneKey` entry through `decodeSnapshot`, before the scene is made.
 * `scene` may be an `EditingSession`: restored entries' recorded selection changes replay into the one passed.
 */
export function useSessionPersistence<D, L extends string, P>(
  scene: Scene<D, L, P>,
  opts: SessionPersistenceOptions,
): void {
  const optsRef = useLatest(opts);

  // After a reload, a restored entry's ops that wrote no scene state (a selection change) replay
  // against this adapter.
  useEffect(() => {
    const a = defaultCommitAdapter(scene);
    scene.setHistoryAdapter(() => a);
    return () => scene.setHistoryAdapter(null);
  }, [scene]);

  // `restoredRef` holds the save off until the restore has run, so it can't clobber the saved
  // history with the empty initial stack first.
  const restoredRef = useRef(false);
  useEffect(() => {
    const { historyKey, loadHistory, records, historyRecovery, onHistoryRestore } = optsRef.current;
    const slots = sessionSlots(records);
    const history = slots.slot(historyKey);
    let snap: unknown = null;
    try { snap = loadHistory ? loadHistory() : readSlot(history, (value) => value, () => null); } catch { /* treated as none */ }
    if (snap !== null) {
      let outcome: HistoryRestore | { status: 'failed'; error: unknown };
      // A stack this build cannot restore must not wedge every boot: it is dropped, and the stack starts empty.
      try { outcome = restorePairedHistory(scene, snap, { recovery: historyRecovery ?? 'strict' }); }
      catch (error) { outcome = { status: 'failed', error }; }
      if (outcome.status !== 'restored') history.records.delete(history.name);
      onHistoryRestore?.(outcome);
    }
    void slots.close();
    restoredRef.current = true;
    // Run once; the scene is stable for the app lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scene and history go under separate keys so a shape migration of one never disturbs the other.
  useAutosave(() => {
    if (!restoredRef.current) return null;
    const { sceneKey, historyKey } = optsRef.current;
    const saved = encodeSceneDocument(scene);
    return {
      primary: [sceneKey, { ...(saved.scene as object), savedAt: Date.now() }],
      dependents: [[historyKey, saved.history]],
    };
  }, {
    onSaved: (ok) => optsRef.current.onSaved?.(ok),
    ...(opts.records ? { records: opts.records } : {}),
    ...(opts.debounceMs !== undefined ? { debounceMs: opts.debounceMs } : {}),
  });
}
