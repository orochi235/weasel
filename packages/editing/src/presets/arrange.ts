import {
  alignBottomAction, alignCenterXAction, alignCenterYAction, alignLeftAction, alignRightAction, alignTopAction,
} from '../actions/align/action';
import { reorderBackwardAction, reorderForwardAction } from '../actions/reorder/reorder';
import { distributeHorizontalAction, distributeVerticalAction } from '../actions/distribute/action';
import { flipAction } from '../actions/flip/action';
import type { FeaturePreset } from '@weasel-js/core';
import { selectionPreset } from './selection';

/** Flipping the selection. */
export const flipPreset: FeaturePreset = { id: 'flip', label: 'Flip', actions: [flipAction], includes: [selectionPreset] };
/** Bringing forward and sending backward. */
export const reorderPreset: FeaturePreset = {
  id: 'reorder', label: 'Reorder', actions: [reorderForwardAction, reorderBackwardAction],
  includes: [selectionPreset],
};
/** Aligning edges and centers. */
export const alignPreset: FeaturePreset = {
  id: 'align',
  label: 'Align',
  actions: [alignLeftAction, alignCenterXAction, alignRightAction, alignTopAction, alignCenterYAction, alignBottomAction],
  includes: [selectionPreset],
};
/** Distributing across or down. */
export const distributePreset: FeaturePreset = {
  id: 'distribute', label: 'Distribute', actions: [distributeHorizontalAction, distributeVerticalAction],
  includes: [selectionPreset],
};

/** Align, distribute, reorder, and flip. */
export const arrangePreset: FeaturePreset = {
  id: 'arrange',
  label: 'Arrange',
  includes: [flipPreset, reorderPreset, alignPreset, distributePreset],
};
