import { writeLocal } from '@weasel-js/storage';
import { readStored, useSessionPersistence as useEditorSession } from '@weasel-js/editor';
import type { DrawScene } from './drawDocument';
import { retireLegacyDoc } from './docPersistence';
import { reportSessionSave } from './fileNotices';
import { LEGACY_HISTORY_KEY, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';
import { sessionRecords } from './sessionRecords';

function loadHistory(): unknown {
  writeLocal(LEGACY_HISTORY_KEY, undefined);
  return readStored(SCENE_HISTORY_KEY, (value) => value, () => null, sessionRecords());
}

/** The drawing and its undo stack, kept under draw's keys in the session's records (`sessionRecords`). Once the drawing is saved, the
 *  paper size and background an older one kept beside it are let go: the saved scene holds them. */
export function useSessionPersistence(scene: DrawScene): void {
  useEditorSession(scene, {
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
