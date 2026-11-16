import { cloneAction, moveAction, resizeAction, rotateAction, PRESET_CHROME } from '@weasel-js/core';
import {
  selectionMoveContribution,
  selectionResizeContribution,
  selectionRotateContribution,
} from '@weasel-js/core';
import type { FeaturePreset } from '@weasel-js/core';

/** The selection outline, drawn only while this is on. */
export const outlinePreset: FeaturePreset = {
  id: 'outline',
  label: 'Outline',
  chrome: PRESET_CHROME.outline,
};

/** Resize handles, drawn and bound. A handle sits over the selected body, so
 *  it refines `move`, whose binding matches a handle drag too. */
export const resizePreset: FeaturePreset = {
  id: 'resize',
  label: 'Resize',
  refines: ['move'],
  actions: [resizeAction],
  ambient: () => selectionResizeContribution(),
  chrome: PRESET_CHROME.resize,
};

/** The rotation handle, drawn and bound. It refines `move` as `resize` does. */
export const rotatePreset: FeaturePreset = {
  id: 'rotate',
  label: 'Rotate',
  refines: ['move'],
  actions: [rotateAction],
  ambient: ({ rotate }) => selectionRotateContribution({ rotate }),
  chrome: PRESET_CHROME.rotate,
};

/** Drag a body to move it, Alt-drag to clone it, under any tool that does not
 *  claim the drag. */
export const movePreset: FeaturePreset = {
  id: 'move',
  label: 'Move',
  actions: [moveAction, cloneAction],
  ambient: ({ move }) => selectionMoveContribution({ move }),
};
