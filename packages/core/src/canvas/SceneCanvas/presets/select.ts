import { areaSelectAction } from 'interactions/actions/defaults/areaSelect';
import { clearSelectionAction } from 'interactions/actions/defaults/clearSelection';
import { lassoSelectAction } from 'interactions/actions/lasso-select/action';
import type { FeaturePreset } from '../features';

/** The select tool: click, marquee, lasso, and clearing on an empty click. */
export const selectPreset: FeaturePreset = {
  id: 'select',
  actions: [areaSelectAction, lassoSelectAction, clearSelectionAction],
  tools: ['select'],
};
