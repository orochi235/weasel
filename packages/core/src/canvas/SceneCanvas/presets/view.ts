import { pinchZoomAction } from 'interactions/actions/defaults/pinchZoom';
import { viewportDragPanAction } from 'interactions/actions/defaults/viewportDragPan';
import type { FeaturePreset } from '../features';
import { viewToolsPreset } from './tools';

/** Pan and zoom: the hand tool, drag-pan, and pinch. */
export const viewPreset: FeaturePreset = {
  id: 'view',
  label: 'View',
  actions: [pinchZoomAction, viewportDragPanAction],
  includes: [viewToolsPreset],
};
