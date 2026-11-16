import type { Action } from '@weasel-js/routing';
import { cloneAction, cancelGestureAction, clearSelectionAction, deleteAction, redoAction, undoAction, placeAction, insertRepositionAction, insertRotateAction, lassoSelectAction } from '@weasel-js/core';
import { areaSelectAction, insertAction, moveAction } from '@weasel-js/core/engine';
import { duplicateAction } from './actions/edit/duplicate';
import { escapeAction } from './actions/edit/escape';
import { groupAction, ungroupAction } from './actions/edit/group';
import { nudgeDownAction, nudgeLeftAction, nudgeRightAction, nudgeUpAction } from './actions/edit/nudge';
import { selectAllAction } from './actions/edit/selectAll';
import { transformAgainAction } from './actions/transformAgain/action';

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
