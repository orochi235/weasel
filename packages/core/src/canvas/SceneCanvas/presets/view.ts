import { pinchZoomAction } from 'interactions/actions/defaults/pinchZoom';
import { viewportDragPanAction } from 'interactions/actions/defaults/viewportDragPan';
import type { FeaturePreset } from '../features';

/** Pan and zoom: the hand tool, drag-pan, and pinch. */
export const viewPreset: FeaturePreset = {
  id: 'view',
  actions: [pinchZoomAction, viewportDragPanAction],
  tools: ['hand'],
};
