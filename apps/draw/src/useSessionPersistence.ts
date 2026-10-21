import { useSessionPersistence as useEditorSession } from '@editor/index';
import type { DrawScene } from './drawDocument';
import { reportSessionSave } from './fileNotices';
import { LEGACY_HISTORY_KEY, loadSceneHistory, LS_KEY, SCENE_HISTORY_KEY } from './sceneLoading';

function loadHistory() {
  try { localStorage.removeItem(LEGACY_HISTORY_KEY); } catch { /* best-effort */ }
  return loadSceneHistory();
}

/** The drawing and its undo stack, kept in local storage under draw's keys. */
export function useSessionPersistence(scene: DrawScene): void {
  useEditorSession(scene, {
    sceneKey: LS_KEY,
    historyKey: SCENE_HISTORY_KEY,
    loadHistory,
    onSaved: reportSessionSave,
  });
}
