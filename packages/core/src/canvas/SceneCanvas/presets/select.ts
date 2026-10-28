import { areaSelectAction } from 'interactions/actions/defaults/areaSelect';
import { clearSelectionAction } from 'interactions/actions/defaults/clearSelection';
import { lassoSelectAction } from 'interactions/actions/lasso-select/action';
import type { FeaturePreset } from '../features';
import { selectToolsPreset } from './tools';

/** The select and lasso tools: click, marquee, lasso, and clearing on an empty click. */
export const selectPreset: FeaturePreset = {
  id: 'select',
  label: 'Select',
  actions: [areaSelectAction, lassoSelectAction, clearSelectionAction],
  includes: [selectToolsPreset],
};
