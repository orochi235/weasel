import type { FeaturePreset } from '@weasel-js/core';
import { createSelection } from '../selection/useSelection';

/** The canvas's selection, answering clicks by `selectionOptions`: what every editing preset that writes the
 *  selection includes, so a canvas without it keeps a selection nothing it runs writes. */
export const selectionPreset: FeaturePreset = { id: 'selection', label: 'Selection', selection: createSelection };
