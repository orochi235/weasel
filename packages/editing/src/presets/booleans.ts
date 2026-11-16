import type { FeaturePreset } from '@weasel-js/core';
import { BooleansDeps } from '../deps/presetDeps';

/** The `booleansAdapter` dep over the canvas's path leaves, which the Pathfinder actions and `@weasel-js/path-tools`'
 *  shape builder work through. `pathfinderPreset` includes it. */
export const booleansPreset: FeaturePreset = {
  id: 'booleans',
  label: 'Booleans',
  components: [BooleansDeps],
};
