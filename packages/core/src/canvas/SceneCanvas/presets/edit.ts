import { cancelGestureAction } from 'interactions/actions/defaults/cancelGesture';
import { deleteAction } from 'interactions/actions/defaults/delete';
import { duplicateAction } from 'interactions/actions/defaults/duplicate';
import { escapeAction } from 'interactions/actions/defaults/escape';
import { contextMenuAction } from 'interactions/actions/defaults/contextMenu';
import { groupAction, ungroupAction } from 'interactions/actions/defaults/group';
import {
  nudgeDownAction, nudgeLeftAction, nudgeRightAction, nudgeUpAction,
} from 'interactions/actions/defaults/nudge';
import { selectAllAction } from 'interactions/actions/defaults/selectAll';
import { setFillAction } from 'interactions/actions/defaults/setFill';
import { setFillOpacityAction } from 'interactions/actions/defaults/setFillOpacity';
import { setStrokeAction } from 'interactions/actions/defaults/setStroke';
import { setStrokeOpacityAction } from 'interactions/actions/defaults/setStrokeOpacity';
import {
  clipboardCopyAction, clipboardCutAction, clipboardPasteAction, clipboardPasteEventAction,
} from 'interactions/actions/clipboard/action';
import { transformAgainAction } from 'interactions/actions/transform-again/action';
import type { FeaturePreset } from '../features';

/**
 * Delete, duplicate, group and ungroup, nudge, select-all,
 * Escape, the context menu, cancel-gesture, cut, copy, and paste, fill and
 * stroke, and their keys.
 *
 * Cmd/Ctrl+V arrives as a DOM `paste` event, and two presets answer it. This
 * one brings `clipboard.pasteEvent`, which pastes nodes a kit canvas copied
 * and nothing else; `ingest` takes those plus images, SVG, files, and every
 * OS drop. With both on, `ingest` answers alone.
 */
export const editPreset: FeaturePreset = {
  id: 'edit',
  actions: [
    escapeAction, contextMenuAction, cancelGestureAction, selectAllAction, duplicateAction,
    transformAgainAction,
    deleteAction, groupAction, ungroupAction,
    nudgeUpAction, nudgeDownAction, nudgeLeftAction, nudgeRightAction,
    setFillAction, setStrokeAction, setFillOpacityAction, setStrokeOpacityAction,
    clipboardCutAction, clipboardCopyAction, clipboardPasteAction, clipboardPasteEventAction,
  ],
};
