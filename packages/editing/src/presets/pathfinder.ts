import type { FeaturePreset } from '@weasel-js/core';
import { pathfinderCropAction, pathfinderDivideAction, pathfinderExcludeAction, pathfinderIntersectAction, pathfinderMergeAction, pathfinderSubtractAction, pathfinderTrimAction, pathfinderUnionAction } from '../actions/pathfinder/action';
import { makeBooleanGroupAction } from '../actions/pathfinder/booleanGroupAction';
import { booleansPreset } from './booleans';
import { selectionPreset } from './selection';

/** The pathfinder booleans, the live boolean group, and the `booleansAdapter` they work through. */
export const pathfinderPreset: FeaturePreset = {
  id: 'pathfinder',
  label: 'Pathfinder',
  actions: [
    pathfinderUnionAction, pathfinderSubtractAction, pathfinderIntersectAction, pathfinderExcludeAction,
    pathfinderDivideAction, pathfinderCropAction, pathfinderTrimAction, pathfinderMergeAction,
    makeBooleanGroupAction,
  ],
  includes: [selectionPreset, booleansPreset],
};
