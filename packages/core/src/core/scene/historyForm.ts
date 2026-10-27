import type { SerializedHistory } from '@weasel-js/history';

/** The form a scene's undo entries are recorded in. A serialized history
 *  carries it, and one carrying another is not restored. Form 4 records a
 *  child's pose in its container's frame; form 3 named nodes `mark` and
 *  `group`; form 2 held the scene's own ops for every edit, and before it an
 *  `applyBatch` entry held the ops it was given. */
export const SCENE_HISTORY_FORM = 4;

/** What `Scene.serializeHistory` answers with. */
export interface SerializedSceneHistory extends SerializedHistory {
  form: typeof SCENE_HISTORY_FORM;
}
