import { defaultCommitAdapter, isSerializedScene, type PagesDoc, type Scene, useLatest } from '@weasel-js/core';
import { useEffect, useRef } from 'react';
import { readStored } from './sessionStore';
import { reviveTypedArrays, serializeReplacer, snapshotRebuildsTree } from './snapshot';
import { useAutosave } from './useAutosave';

/** Where `useSessionPersistence` keeps a scene and its undo stack, and what it reports after a save. */
export interface SessionPersistenceOptions {
  /** The local-storage key the scene is saved under. */
  sceneKey: string;
  /** The local-storage key the undo stack is saved under. */
  historyKey: string;
  /** Read the saved undo snapshot; defaults to the parsed `historyKey` entry. Return null for none. */
  loadHistory?: () => unknown;
  /** Called after every save attempt with whether the scene was written. */
  onSaved?: (ok: boolean) => void;
  /** The pages the scene's load gives a snapshot saved without any (`SnapshotLoadOptions.pages`). */
  pages?: PagesDoc;
}

const parseHistory = (raw: string): unknown => reviveTypedArrays(JSON.parse(raw));

/** Whether an undo stack saved beside the scene under `key` would replay wrongly: the scene loads with its
 *  tree rebuilt (`snapshotRebuildsTree`), or there is no saved scene it can be read as, so the scene
 *  starts from something else. */
const savedStale = (key: string, pages: PagesDoc | undefined): boolean =>
  readStored(key, (raw) => {
    const json: unknown = JSON.parse(raw);
    return !isSerializedScene(json) || snapshotRebuildsTree(json, { pages });
  }, () => true);

/**
 * Keeps a scene and its undo stack in local storage: restores the stack once on mount,
 * then saves them through `useAutosave` after each render. A stack saved beside a scene that loads
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
    const { sceneKey, historyKey, loadHistory, pages } = optsRef.current;
    let snap: unknown = null;
    if (savedStale(sceneKey, pages)) {
      try { localStorage.removeItem(historyKey); } catch { /* best-effort */ }
    } else {
      try { snap = loadHistory ? loadHistory() : readStored(historyKey, parseHistory, () => null); } catch { /* treated as none */ }
    }
    if (snap) {
      try {
        scene.restoreHistory(snap as Parameters<typeof scene.restoreHistory>[0]);
      } catch {
        // A parseable-but-malformed snapshot must not wedge every boot:
        // drop it and start with an empty undo stack.
        try { localStorage.removeItem(historyKey); } catch { /* best-effort */ }
      }
    }
    restoredRef.current = true;
    // Run once; the scene is stable for the app lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scene and history go under separate keys so a shape migration of one never disturbs the other.
  useAutosave(() => {
    if (!restoredRef.current) return null;
    const { sceneKey, historyKey } = optsRef.current;
    return {
      primary: [sceneKey, JSON.stringify(scene.toJSON(), serializeReplacer)],
      dependents: [[historyKey, JSON.stringify(scene.serializeHistory(), serializeReplacer)]],
    };
  }, { onSaved: (ok) => optsRef.current.onSaved?.(ok) });
}
