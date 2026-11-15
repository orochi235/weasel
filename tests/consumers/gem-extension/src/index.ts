// #region gem-feature
import { nodeKindPreset } from '@weasel-js/core';
import { GEM_BLUE, gemInsert, gemShape, gemTool, isGem } from './gem.js';
import { tintTool } from './tint.js';

/** The whole feature as one preset: the kind's routing, painter, insert factory, and properties, and its tools. */
export const gemFeature = nodeKindPreset({
  id: 'app:gem',
  label: 'Gems',
  kind: 'gem',                      // routing kind, properties name, insert kind
  matches: isGem,
  shape: gemShape,
  insert: gemInsert,
  properties: {
    schema: {
      name: 'Properties',
      members: {
        gem: {
          name: 'Gem',
          members: {
            'data.gem.color': { kind: 'color', name: 'Color', description: 'The fill of every facet.', default: GEM_BLUE },
            'data.gem.facets': { kind: 'number', name: 'Facets', description: 'How many corners the outline has.', default: 4, min: 3, max: 12 },
          },
        },
      },
    },
  },
  tools: [gemTool, tintTool],
});
// #endregion gem-feature

export { GEM_BLUE, gemInsert, gemOutline, gemShape, gemTool, isGem, type GemData } from './gem.js';
export { GEM_PALETTE, tintAction, tintTool, tintedBy } from './tint.js';
