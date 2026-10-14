import { defaultCommitAdapter } from '@weasel-js/core';
import { useEffect, useRef } from 'react';
import type { DrawScene } from './drawDocument';
import { reportSessionSave } from './fileNotices';
import { serializeReplacer } from './persistence';
import { LEGACY_HISTORY_KEY, loadSceneHistory, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';
import { writeSession } from './sessionStore';

/**
 * Keeps the drawing and its undo stack in local storage: restores the stack once on mount,
 * then saves 300 ms after each render, and at once when the page goes away.
 */
export function useSessionPersistence(scene: DrawScene): void {
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
    try { localStorage.removeItem(LEGACY_HISTORY_KEY); } catch { /* best-effort */ }
    const sceneSnap = loadSceneHistory();
    if (sceneSnap) {
      try {
        scene.restoreHistory(sceneSnap);
      } catch {
        // A parseable-but-malformed snapshot must not wedge every boot:
        // drop it and start with an empty undo stack.
        try { localStorage.removeItem(SCENE_HISTORY_KEY); } catch { /* best-effort */ }
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
      try {
        reportSessionSave(writeSession(
          localStorage,
          [LS_KEY, JSON.stringify(scene.toJSON(), serializeReplacer)],
          [
            [SCENE_HISTORY_KEY, JSON.stringify(scene.serializeHistory(), serializeReplacer)],
          ],
        ));
      } catch {
        // No store at all, or a scene that will not serialize.
        reportSessionSave(false);
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
