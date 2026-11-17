import { cancelAllAction, contextMenuAction } from '@weasel-js/core';
import type { FeaturePreset } from '@weasel-js/core';
import { duplicateAction } from '../actions/edit/duplicate';
import { deselectAction } from '../actions/edit/deselect';
import { groupAction, ungroupAction } from '../actions/edit/group';
import { selectAllAction } from '../actions/edit/selectAll';
import { setFillAction } from '../actions/edit/setFill';
import { setFillOpacityAction } from '../actions/edit/setFillOpacity';
import { setStrokeAction } from '../actions/edit/setStroke';
import { setStrokeOpacityAction } from '../actions/edit/setStrokeOpacity';
import { setStrokeWidthAction } from '../actions/edit/setStrokeWidth';
import { setVertexColorAction } from '../actions/edit/setVertexColor';
import { transformAgainAction } from '../actions/transformAgain/action';
import { nudgeDownAction, nudgeLeftAction, nudgeRightAction, nudgeUpAction } from '../actions/edit/nudge';
import { insertPreset } from './insert';
import { clipboardCopyAction, clipboardCutAction, clipboardPasteAction, clipboardPasteCopiedAction } from '../actions/clipboard/action';
import { selectionPreset } from './selection';
import { deleteAction } from '../actions/delete/delete';

/** Escape, and canceling the gesture in flight. */
export const escapePreset: FeaturePreset = { id: 'escape', label: 'Escape', actions: [deselectAction, cancelAllAction], includes: [selectionPreset] };
/** The context menu. */
export const contextMenuPreset: FeaturePreset = { id: 'contextMenu', label: 'Context menu', actions: [contextMenuAction], includes: [selectionPreset] };
/** Cmd/Ctrl+A. */
export const selectAllPreset: FeaturePreset = { id: 'selectAll', label: 'Select all', actions: [selectAllAction], includes: [selectionPreset] };
/** Duplicate, and repeating the last transform. */
export const duplicatePreset: FeaturePreset = { id: 'duplicate', label: 'Duplicate', actions: [duplicateAction, transformAgainAction], includes: [selectionPreset] };
/** Deleting the selection. */
export const deletePreset: FeaturePreset = { id: 'delete', label: 'Delete', actions: [deleteAction], includes: [selectionPreset] };
/** Group and ungroup. */
export const groupPreset: FeaturePreset = { id: 'group', label: 'Group', actions: [groupAction, ungroupAction], includes: [selectionPreset] };
/** The arrow keys. */
export const nudgePreset: FeaturePreset = {
  id: 'nudge', label: 'Nudge', actions: [nudgeUpAction, nudgeDownAction, nudgeLeftAction, nudgeRightAction],
  includes: [selectionPreset],
};
/** Fill and stroke, their opacities, the stroke's width, and a path's vertex colors. */
export const stylePreset: FeaturePreset = {
  id: 'style',
  label: 'Style',
  actions: [
    setFillAction, setStrokeAction, setFillOpacityAction, setStrokeOpacityAction, setStrokeWidthAction, setVertexColorAction,
  ],
  includes: [selectionPreset],
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
  actions: [clipboardCutAction, clipboardCopyAction, clipboardPasteAction, clipboardPasteCopiedAction],
  includes: [insertPreset],
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
