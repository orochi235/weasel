import {
  defaultCommitAdapter, isSerializedScene, type HistoryRecovery, type HistoryRestoreReport, type PagesDoc, type Scene, useLatest,
} from '@weasel-js/core';
import type { RecordCache } from '@weasel-js/storage';
import { useEffect, useRef } from 'react';
import { keptUnreadable, readSlot, type SessionSlot, sessionSlots } from './sessionStore';
import { reviveTypedArrays, snapshotRebuildsTree, snapshotValue } from './snapshot';
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
  /** Read the saved undo snapshot; defaults to the `historyKey` entry. Return null for none. */
  loadHistory?: () => unknown;
  /** How long after a change the save runs, as `useAutosave` takes it. Defaults to 300 ms. */
  debounceMs?: number;
  /** Called after every save attempt with whether the scene was written. */
  onSaved?: (ok: boolean) => void;
  /** The pages the scene's load gives a snapshot saved without any (`SnapshotLoadOptions.pages`). */
  pages?: PagesDoc;
  /** How the saved undo stack is restored (`Scene.restoreHistory`'s `recovery`). Defaults to `'strict'`, under which
   *  a stack naming an op this build cannot replay is dropped whole. */
  historyRecovery?: HistoryRecovery;
  /** Called once a saved undo stack has been read: with the restore's report, or with the error that dropped it. */
  onHistoryRestore?: (outcome: { report: HistoryRestoreReport } | { error: unknown }) => void;
}

/** Whether an undo stack saved beside the scene in `slot` would replay wrongly: the scene loads with its
 *  tree rebuilt (`snapshotRebuildsTree`), or there is no saved scene it can be read as, so the scene
 *  starts from something else, as it does from one its load kept aside as unreadable. */
const savedStale = (slot: SessionSlot, pages: PagesDoc | undefined): boolean =>
  readSlot(slot, (json) => keptUnreadable(slot, json) || !isSerializedScene(json) || snapshotRebuildsTree(json, { pages }),
    () => true);

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
 * then saves them through `useAutosave` after each render, the scene stamped with when it was saved ({@link savedAtOf}). A stack saved beside a scene that loads
 * with its tree rebuilt (`snapshotRebuildsTree`, with `opts.pages`), or beside none that can be read, is
 * dropped, not restored.
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
    const { sceneKey, historyKey, loadHistory, pages, records, historyRecovery, onHistoryRestore } = optsRef.current;
    const slots = sessionSlots(records);
    const history = slots.slot(historyKey);
    const drop = (): void => history.records.delete(history.name);
    let snap: unknown = null;
    if (savedStale(slots.slot(sceneKey), pages)) drop();
    else {
      try { snap = loadHistory ? loadHistory() : readSlot(history, reviveTypedArrays, () => null); } catch { /* treated as none */ }
    }
    if (snap) {
      try {
        const report = scene.restoreHistory(snap as Parameters<typeof scene.restoreHistory>[0], { recovery: historyRecovery ?? 'strict' });
        onHistoryRestore?.({ report });
      } catch (error) {
        // A snapshot this build cannot restore must not wedge every boot:
        // drop it and start with an empty undo stack.
        drop();
        onHistoryRestore?.({ error });
      }
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
    return {
      primary: [sceneKey, { ...(snapshotValue(scene.toJSON()) as object), savedAt: Date.now() }],
      dependents: [[historyKey, snapshotValue(scene.serializeHistory())]],
    };
  }, {
    onSaved: (ok) => optsRef.current.onSaved?.(ok),
    ...(opts.records ? { records: opts.records } : {}),
    ...(opts.debounceMs !== undefined ? { debounceMs: opts.debounceMs } : {}),
  });
}
