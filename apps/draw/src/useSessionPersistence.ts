import { useSessionPersistence as useEditorSession } from '@weasel-js/editor';
import { useState } from 'react';
import type { DrawScene } from './drawDocument';
import { retireLegacyDoc } from './docPersistence';
import { reportSessionSave } from './fileNotices';
import { fallbackPages, LEGACY_HISTORY_KEY, loadSceneHistory, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';
import { sessionRecords } from './sessionRecords';

function loadHistory() {
  try { localStorage.removeItem(LEGACY_HISTORY_KEY); } catch { /* best-effort */ }
  return loadSceneHistory();
}

/** The drawing and its undo stack, kept under draw's keys in the session's records (`sessionRecords`). Once the drawing is saved, the
 *  paper size and background an older one kept beside it are let go: the saved scene holds them. */
export function useSessionPersistence(scene: DrawScene): void {
  const [pages] = useState(fallbackPages);
  useEditorSession(scene, {
    pages,
    sceneKey: LS_KEY,
    historyKey: SCENE_HISTORY_KEY,
    records: sessionRecords(),
    loadHistory,
    onSaved: (ok) => {
      if (ok) retireLegacyDoc();
      reportSessionSave(ok);
    },
  });
}
