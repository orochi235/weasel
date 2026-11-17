import { touchZoomAction } from 'interactions/actions/defaults/touchZoom';
import { viewportDragPanAction } from 'interactions/actions/defaults/viewportDragPan';
import { middleDragPanContribution } from 'tools/builtin/hand/dragPanContribution';
import type { FeaturePreset } from '../features';
import { viewToolsPreset } from './viewTools';

/** Pan and zoom: the hand tool, drag-pan, middle-button drag-pan under any tool, and pinch. */
export const viewPreset: FeaturePreset = {
  id: 'view',
  label: 'View',
  actions: [touchZoomAction, viewportDragPanAction],
  ambient: () => middleDragPanContribution(),
  includes: [viewToolsPreset],
};
