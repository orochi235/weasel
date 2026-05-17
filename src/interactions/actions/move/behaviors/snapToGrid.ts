import type { ModifierState, MoveBehavior } from '../../../gestures/types';
import { snap } from '../../../gestures/shared/snap';
import { gridSnapStrategy } from '../../../gestures/shared/strategies/grid';

type ModKey = keyof ModifierState;

export function snapToGrid<TPose extends { x: number; y: number }>(args: {
  spacing: number;
  bypassKey?: ModKey;
}): MoveBehavior<TPose> {
  return snap(gridSnapStrategy<TPose>(args.spacing), { bypassKey: args.bypassKey });
}
