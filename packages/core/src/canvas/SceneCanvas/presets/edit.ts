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

/** Escape, and canceling the gesture in flight. */
export const escapePreset: FeaturePreset = { id: 'escape', label: 'Escape', actions: [escapeAction, cancelGestureAction] };
/** The context menu. */
export const contextMenuPreset: FeaturePreset = { id: 'contextMenu', label: 'Context menu', actions: [contextMenuAction] };
/** Cmd/Ctrl+A. */
export const selectAllPreset: FeaturePreset = { id: 'selectAll', label: 'Select all', actions: [selectAllAction] };
/** Duplicate, and repeating the last transform. */
export const duplicatePreset: FeaturePreset = { id: 'duplicate', label: 'Duplicate', actions: [duplicateAction, transformAgainAction] };
/** Deleting the selection. */
export const deletePreset: FeaturePreset = { id: 'delete', label: 'Delete', actions: [deleteAction] };
/** Group and ungroup. */
export const groupPreset: FeaturePreset = { id: 'group', label: 'Group', actions: [groupAction, ungroupAction] };
/** The arrow keys. */
export const nudgePreset: FeaturePreset = {
  id: 'nudge', label: 'Nudge', actions: [nudgeUpAction, nudgeDownAction, nudgeLeftAction, nudgeRightAction],
};
/** Fill and stroke, and their opacities. */
export const stylePreset: FeaturePreset = {
  id: 'style', label: 'Style', actions: [setFillAction, setStrokeAction, setFillOpacityAction, setStrokeOpacityAction],
};

/**
 * Cut, copy, and paste.
 *
 * Cmd/Ctrl+V arrives as a DOM `paste` event, and two presets answer it. This
 * one brings `clipboard.pasteEvent`, which pastes nodes a kit canvas copied
 * and nothing else; `ingest` takes those plus images, SVG, files, and every
 * OS drop. With both on, `ingest` answers alone.
 */
export const clipboardPreset: FeaturePreset = {
  id: 'clipboard',
  label: 'Clipboard',
  actions: [clipboardCutAction, clipboardCopyAction, clipboardPasteAction, clipboardPasteEventAction],
};

/** Every edit preset above, and their keys. */
export const editPreset: FeaturePreset = {
  id: 'edit',
  label: 'Edit',
  includes: [
    escapePreset, contextMenuPreset, selectAllPreset, duplicatePreset, deletePreset, groupPreset, nudgePreset,
    stylePreset, clipboardPreset,
  ],
};
