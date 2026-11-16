import type { SelectionChrome } from '@weasel-js/core';
import { createCornerResizeAffordance } from './affordances/cornerResize';
import { createRotationAffordance } from './affordances/rotationHandle';
import { createSelectionOverlayLayer, rotationBadgeOf } from './overlay';

/** The kit's selection chrome: the outline, resize handles and rotate badge it paints, and the rotate ring and
 *  handles a press grabs, beneath the canvas's anchors. */
export const SELECTION_CHROME: SelectionChrome = {
  overlay: (options) => createSelectionOverlayLayer(options),
  rotationBadgeOf,
  affordances: ({ handleHitRadius, rotateBandPx, rotationBadge, edgeHandles }) => [
    createRotationAffordance({
      bandPx: rotateBandPx,
      paint: null,
      ...(rotationBadge ? { handle: { distancePx: rotationBadge.distancePx, hitRadiusPx: rotationBadge.sizePx } } : {}),
    }),
    createCornerResizeAffordance({ handleHitRadius, edges: edgeHandles }),
  ],
};
