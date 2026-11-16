import { PRESET_CHROME } from '@weasel-js/core';
import type { FeaturePreset } from '@weasel-js/core';
import { selectionMoveContribution, selectionResizeContribution, selectionRotateContribution } from '../tools/select/selectionContributions';
import { selectionPreset } from './selection';
import { selectionChromePreset } from './selectionChrome';
import { cloneAction } from '../actions/clone/action';
import { moveAction } from '../actions/move/action';
import { resizeAction } from '../actions/resize/action';
import { rotateAction } from '../actions/rotate/action';
import { ResizePolicyDeps } from '../deps/presetDeps';

/** The selection outline, drawn only while this is on. */
export const outlinePreset: FeaturePreset = {
  id: 'outline',
  label: 'Outline',
  chrome: PRESET_CHROME.outline,
  includes: [selectionChromePreset],
};

/** Resize handles, drawn and bound. A handle sits over the selected body, so
 *  it refines `move`, whose binding matches a handle drag too. */
export const resizePreset: FeaturePreset = {
  id: 'resize',
  label: 'Resize',
  refines: ['move'],
  actions: [resizeAction],
  components: [ResizePolicyDeps],
  ambient: () => selectionResizeContribution(),
  chrome: PRESET_CHROME.resize,
  includes: [selectionChromePreset],
};

/** The rotation handle, drawn and bound. It refines `move` as `resize` does. */
export const rotatePreset: FeaturePreset = {
  id: 'rotate',
  label: 'Rotate',
  refines: ['move'],
  actions: [rotateAction],
  ambient: ({ rotate }) => selectionRotateContribution({ rotate }),
  chrome: PRESET_CHROME.rotate,
  includes: [selectionChromePreset],
};

/** Drag a body to move it, Alt-drag to clone it, under any tool that does not
 *  claim the drag. */
export const movePreset: FeaturePreset = {
  id: 'move',
  label: 'Move',
  actions: [moveAction, cloneAction],
  ambient: ({ move }) => selectionMoveContribution({ move }),
  includes: [selectionPreset],
};
