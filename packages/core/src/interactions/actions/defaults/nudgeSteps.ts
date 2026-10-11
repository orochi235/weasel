/** The arrow-key nudge shared by nodes and path anchors: one direction per
 *  key, a small step bare and a big one with Shift. */
export type NudgeDirection = 'up' | 'down' | 'left' | 'right';

export const NUDGE_KEY: Record<NudgeDirection, string> = {
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
};

export const NUDGE_LABEL: Record<NudgeDirection, string> = {
  up: 'Up', down: 'Down', left: 'Left', right: 'Right',
};

const SMALL_STEP = 1;
const BIG_STEP = 10;

/** The world delta of one nudge. `magnitude` is the binding param: `'big'`
 *  for the Shift step, anything else for the small one. */
export function nudgeDelta(dir: NudgeDirection, magnitude: unknown): { dx: number; dy: number } {
  const step = magnitude === 'big' ? BIG_STEP : SMALL_STEP;
  switch (dir) {
    case 'up':    return { dx: 0,     dy: -step };
    case 'down':  return { dx: 0,     dy:  step };
    case 'left':  return { dx: -step, dy: 0     };
    case 'right': return { dx:  step, dy: 0     };
  }
}
