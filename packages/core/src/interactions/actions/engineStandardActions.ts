import type { Action } from '@weasel-js/routing';
import { cloneAction } from './clone/action';
import { areaSelectAction } from './defaults/areaSelect';
import { cancelGestureAction } from './defaults/cancelGesture';
import { clearSelectionAction } from './defaults/clearSelection';
import { deleteAction } from './defaults/delete';
import { duplicateAction } from './defaults/duplicate';
import { escapeAction } from './defaults/escape';
import { groupAction, ungroupAction } from './defaults/group';
import { nudgeDownAction, nudgeLeftAction, nudgeRightAction, nudgeUpAction } from './defaults/nudge';
import { selectAllAction } from './defaults/selectAll';
import { redoAction, undoAction } from './defaults/undoRedo';
import { insertAction } from './insert/action';
import { placeAction } from './insert/placeAction';
import { insertRepositionAction } from './insert/repositionAction';
import { insertRotateAction } from './insert/rotateAction';
import { lassoSelectAction } from './lasso-select/action';
import { moveAction } from './move/action';
import { transformAgainAction } from './transform-again/action';

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
