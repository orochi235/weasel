import { harmonizeAnchors } from '@weasel-js/geom';
import { makeHandleCommand } from '@weasel-js/core';
import { icon } from '../icons.gen';

/**
 * Make the selected smooth anchors curvature-continuous by adjusting their
 * handle lengths, or every smooth anchor of the path while none is selected.
 */
export const harmonizeAnchorsAction = makeHandleCommand(
  'harmonizeAnchors',
  'Harmonize curvature',
  icon('core:harmonize'),
  harmonizeAnchors,
  'selectedOrAll',
);
