import { areaSelectAction, clearSelectionAction, lassoSelectAction } from '@weasel-js/core';
import type { FeaturePreset } from '@weasel-js/core';
import { selectToolsPreset } from './tools';

/** The select and lasso tools: click, marquee, lasso, and clearing on an empty click. */
export const selectPreset: FeaturePreset = {
  id: 'select',
  label: 'Select',
  actions: [areaSelectAction, lassoSelectAction, clearSelectionAction],
  includes: [selectToolsPreset],
};
