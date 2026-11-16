import type { FeaturePreset } from '@weasel-js/core';
import { pathfinderCropAction, pathfinderDivideAction, pathfinderExcludeAction, pathfinderIntersectAction, pathfinderMergeAction, pathfinderSubtractAction, pathfinderTrimAction, pathfinderUnionAction } from '../actions/pathfinder/action';
import { makeBooleanGroupAction } from '../actions/pathfinder/booleanGroupAction';

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
