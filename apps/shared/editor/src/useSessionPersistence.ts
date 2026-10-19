import { defaultCommitAdapter, type Scene, useLatest } from '@weasel-js/core';
import { useEffect, useRef } from 'react';
import { writeSession } from './sessionStore';
import { reviveTypedArrays, serializeReplacer } from './snapshot';

export interface SessionPersistenceOptions {
  sceneKey: string;
  historyKey: string;
  /** Read the saved undo snapshot; defaults to the parsed `historyKey` entry. Return null for none. */
  loadHistory?: () => unknown;
  /** Called after every save attempt with whether the scene was written. */
  onSaved?: (ok: boolean) => void;
}

function readHistory(historyKey: string): unknown {
  const raw = localStorage.getItem(historyKey);
  return raw ? reviveTypedArrays(JSON.parse(raw)) : null;
}

/**
 * Keeps a scene and its undo stack in local storage: restores the stack once on mount,
 * then saves 300 ms after each render, and at once when the page goes away.
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

  // `restoredRef` unblocks the save below, so it can't clobber the saved history with the empty
  // initial stack first.
  const restoredRef = useRef(false);
  useEffect(() => {
    const { historyKey, loadHistory } = optsRef.current;
    let snap: unknown = null;
    try { snap = loadHistory ? loadHistory() : readHistory(historyKey); } catch { /* treated as none */ }
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
  const pendingSaveRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const save = (): void => {
      pendingSaveRef.current = null;
      if (!restoredRef.current) return;
      const { sceneKey, historyKey, onSaved } = optsRef.current;
      try {
        onSaved?.(writeSession(
          localStorage,
          [sceneKey, JSON.stringify(scene.toJSON(), serializeReplacer)],
          [[historyKey, JSON.stringify(scene.serializeHistory(), serializeReplacer)]],
        ));
      } catch {
        // No store at all, or a scene that will not serialize.
        onSaved?.(false);
      }
    };
    pendingSaveRef.current = save;
    const id = setTimeout(save, 300);
    return () => clearTimeout(id);
  });
  useEffect(() => {
    const flush = (): void => pendingSaveRef.current?.();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);
}
