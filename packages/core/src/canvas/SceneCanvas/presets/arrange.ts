import {
  alignBottomAction, alignCenterXAction, alignCenterYAction, alignLeftAction, alignRightAction, alignTopAction,
} from 'interactions/actions/align/action';
import { reorderBackwardAction, reorderForwardAction } from 'interactions/actions/defaults/reorder';
import { distributeHorizontalAction, distributeVerticalAction } from 'interactions/actions/distribute/action';
import { flipAction } from 'interactions/actions/flip/action';
import type { FeaturePreset } from '../features';

/** Align, distribute, reorder, and flip. */
export const arrangePreset: FeaturePreset = {
  id: 'arrange',
  actions: [
    flipAction,
    reorderForwardAction, reorderBackwardAction,
    alignLeftAction, alignCenterXAction, alignRightAction,
    alignTopAction, alignCenterYAction, alignBottomAction,
    distributeHorizontalAction, distributeVerticalAction,
  ],
};
