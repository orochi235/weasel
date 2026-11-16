import type { Action } from '@weasel-js/routing';
import { cancelGestureAction, redoAction, undoAction } from '@weasel-js/core';
import { duplicateAction } from './actions/edit/duplicate';
import { escapeAction } from './actions/edit/escape';
import { groupAction, ungroupAction } from './actions/edit/group';
import { nudgeDownAction, nudgeLeftAction, nudgeRightAction, nudgeUpAction } from './actions/edit/nudge';
import { selectAllAction } from './actions/edit/selectAll';
import { transformAgainAction } from './actions/transformAgain/action';
import { cloneAction } from './actions/clone/action';
import { clearSelectionAction } from './actions/select/clearSelection';
import { placeAction } from './actions/insert/placeAction';
import { insertRepositionAction } from './actions/insert/repositionAction';
import { insertRotateAction } from './actions/insert/rotateAction';
import { lassoSelectAction } from './actions/lassoSelect/action';
import { areaSelectAction } from './actions/select/areaSelect';
import { insertAction } from './actions/insert/action';
import { moveAction } from './actions/move/action';
import { deleteAction } from './actions/delete/delete';

/**
 * The kit-standard actions a host of any dimension registers: history,
 * selection, move and clone, insert, nudge, duplicate, delete, group, and the
 * keys that leave a gesture. Pass it to `useActionSet`. None loads the 2D stack;
 * the 2D editing features (style, align, paths, clipboard, ingest) are
 * `useStandardActions`' alone.
 */
export const ENGINE_STANDARD_ACTIONS: readonly Action[] = [
  undoAction, redoAction,
  areaSelectAction, lassoSelectAction, clearSelectionAction, selectAllAction,
  moveAction, cloneAction, transformAgainAction,
  insertAction, placeAction, insertRotateAction, insertRepositionAction,
  nudgeUpAction, nudgeDownAction, nudgeLeftAction, nudgeRightAction,
  duplicateAction, deleteAction, groupAction, ungroupAction,
  escapeAction, cancelGestureAction,
];
