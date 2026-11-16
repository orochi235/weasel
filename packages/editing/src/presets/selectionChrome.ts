import type { FeaturePreset } from '@weasel-js/core';
import { SELECTION_CHROME } from '../chrome/selectionChrome';
import { selectionPreset } from './selection';

/** The selection chrome, drawn in the `selectionOverlay` slot and grabbed where drawn: what `outlinePreset`,
 *  `resizePreset` and `rotatePreset` include, each turning on its own part of it. */
export const selectionChromePreset: FeaturePreset = {
  id: 'selectionChrome',
  label: 'Selection chrome',
  selectionChrome: SELECTION_CHROME,
  includes: [selectionPreset],
};
