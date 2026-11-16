import {
  pathfinderCropAction, pathfinderDivideAction, pathfinderExcludeAction, pathfinderIntersectAction,
  pathfinderMergeAction, pathfinderSubtractAction, pathfinderTrimAction, pathfinderUnionAction,
} from '@weasel-js/core';
import { makeBooleanGroupAction } from '@weasel-js/core';
import type { FeaturePreset } from '@weasel-js/core';

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
