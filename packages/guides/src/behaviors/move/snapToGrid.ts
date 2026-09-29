import { type ModifierState, type MoveBehavior, snap } from '@weasel-js/core';
import { gridSnapStrategy } from '../../strategies/grid';

type ModKey = keyof ModifierState;

/** Move behavior that snaps the dragged pose's origin to a grid. Hold
 *  `bypassKey` to drag freely. */
export function snapToGrid<TPose extends { x: number; y: number }>(args: {
  spacing: number;
  bypassKey?: ModKey;
}): MoveBehavior<TPose> {
  return snap(gridSnapStrategy<TPose>(args.spacing), { bypassKey: args.bypassKey });
}
