import type { SerializedHistory } from '@weasel-js/history';

/** The form a scene's undo entries are recorded in. A serialized history
 *  carries it, and one carrying another is not restored. Form 3 names
 *  nodes `mark` and `group`; form 2 held the scene's own ops for every edit,
 *  and before it an `applyBatch` entry held the ops it was given. */
export const SCENE_HISTORY_FORM = 3;

/** What `Scene.serializeHistory` answers with. */
export interface SerializedSceneHistory extends SerializedHistory {
  form: typeof SCENE_HISTORY_FORM;
}
