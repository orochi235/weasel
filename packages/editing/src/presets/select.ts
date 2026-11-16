import { areaSelectAction, clearSelectionAction, lassoSelectAction } from '@weasel-js/core';
import type { FeaturePreset } from '@weasel-js/core';
import { createGroupEntryContribution } from '../tools/select/groupEntry';
import { selectToolsPreset } from './tools';
import { selectionPreset } from './selection';

/** The select and lasso tools: click, marquee, lasso, and clearing on an empty click; and entering a group on a
 *  double-click and leaving it on Escape. */
export const selectPreset: FeaturePreset = {
  id: 'select',
  label: 'Select',
  actions: [areaSelectAction, lassoSelectAction, clearSelectionAction],
  includes: [selectionPreset, selectToolsPreset],
  build: (ctx) => ({
    contributions: [createGroupEntryContribution({
      pickHit: (world, viewId) => (viewId == null ? ctx.pick.bestIn(world) : ctx.pick.bestIn(world, viewId)),
      tree: { getParent: (id) => ctx.adapter().getParent(id), getNode: (id) => ctx.adapter().getNode(id) },
      boxOf: (id) => ctx.pick.boundsOf(id),
    })],
  }),
};
