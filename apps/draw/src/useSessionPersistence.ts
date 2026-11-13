import { useSessionPersistence as useEditorSession } from '@weasel-js/editor';
import { useState } from 'react';
import type { DrawScene } from './drawDocument';
import { retireLegacyDoc } from './docPersistence';
import { reportSessionSave } from './fileNotices';
import { fallbackPages, LEGACY_HISTORY_KEY, loadSceneHistory, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';

function loadHistory() {
  try { localStorage.removeItem(LEGACY_HISTORY_KEY); } catch { /* best-effort */ }
  return loadSceneHistory();
}

/** The drawing and its undo stack, kept in local storage under draw's keys. Once the drawing is saved, the
 *  paper size and background an older one kept beside it are let go: the saved scene holds them. */
export function useSessionPersistence(scene: DrawScene): void {
  const [pages] = useState(fallbackPages);
  useEditorSession(scene, {
    pages,
    sceneKey: LS_KEY,
    historyKey: SCENE_HISTORY_KEY,
    loadHistory,
    onSaved: (ok) => {
      if (ok) retireLegacyDoc();
      reportSessionSave(ok);
    },
  });
}
