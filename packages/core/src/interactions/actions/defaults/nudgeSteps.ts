import { arrowMove } from '@weasel-js/ui-input';
import type { GestureBinding } from '@weasel-js/routing';
import { BETWEEN_GESTURES } from '@weasel-js/routing';

/** The arrow-key nudge shared by nodes and path anchors: one direction per
 *  key, a small step bare and a big one with Shift. */
export type NudgeDirection = 'up' | 'down' | 'left' | 'right';

export const NUDGE_KEY: Record<NudgeDirection, string> = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
};

export const NUDGE_LABEL: Record<NudgeDirection, string> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
};

/** The world delta of one nudge. `magnitude` is the binding param: `'big'`
 *  for the Shift step, anything else for the small one. */
export function nudgeDelta(dir: NudgeDirection, magnitude: unknown): { dx: number; dy: number } {
  return arrowMove(NUDGE_KEY[dir], magnitude === 'big')!;
}

/** The key a nudge in `dir` binds, Shift held for the big step. Not while any
 *  gesture is in flight: a drag holds the poses it started from, so an arrow
 *  mid-drag would land a nudge the drag's preview hides. */
export function nudgeSpec(dir: NudgeDirection, big: boolean): GestureBinding['spec'] {
  return {
    kind: 'key',
    key: NUDGE_KEY[dir],
    ...(big ? { mods: { shift: true } } : {}),
    phase: BETWEEN_GESTURES,
  };
}
