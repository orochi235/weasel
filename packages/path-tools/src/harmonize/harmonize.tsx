import { harmonizeAnchors } from '@weasel-js/geom';
import { HarmonizeIcon, makeHandleCommand } from '@weasel-js/core';

/**
 * Make the selected smooth anchors curvature-continuous by adjusting their
 * handle lengths, or every smooth anchor of the path while none is selected.
 */
export const harmonizeAnchorsAction = makeHandleCommand(
  'harmonizeAnchors',
  'Harmonize curvature',
  <HarmonizeIcon />,
  harmonizeAnchors,
  'selectedOrAll',
);
