import { fairAnchors } from '@weasel-js/geom';
import { createHandleCommand } from '../pathEdit/anchorHandles';
import { icon } from '../icons.gen';

/**
 * Make the selected smooth anchors curvature-continuous by adjusting their
 * handle lengths, or every smooth anchor of the path while none is selected.
 */
export const fairAnchorsAction = createHandleCommand(
  'fairAnchors',
  'Fairing',
  icon('core:fairing'),
  fairAnchors,
  'selectedOrAll',
);
