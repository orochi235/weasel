import {
  pathfinderCropAction, pathfinderDivideAction, pathfinderExcludeAction, pathfinderIntersectAction,
  pathfinderMergeAction, pathfinderSubtractAction, pathfinderTrimAction, pathfinderUnionAction,
} from 'interactions/actions/booleans/action';
import { makeBooleanGroupAction } from 'interactions/actions/booleans/booleanGroupAction';
import type { FeaturePreset } from '../features';

/** The pathfinder booleans, and the live boolean group. */
export const pathfinderPreset: FeaturePreset = {
  id: 'pathfinder',
  label: 'Pathfinder',
  actions: [
    pathfinderUnionAction, pathfinderSubtractAction, pathfinderIntersectAction, pathfinderExcludeAction,
    pathfinderDivideAction, pathfinderCropAction, pathfinderTrimAction, pathfinderMergeAction,
    makeBooleanGroupAction,
  ],
};
