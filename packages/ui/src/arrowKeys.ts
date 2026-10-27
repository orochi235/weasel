/** What a key event carries that these rules read. */
type KeyLike = { key: string; shiftKey: boolean };

/** How many steps one arrow press takes with shift held. */
const SHIFT_STEPS = 10;

/** Steps an arrow key asks for along one axis: one, or ten with shift, positive toward
 *  ArrowRight and ArrowUp. `null` for any other key. A caller multiplies by its own step. */
export function arrowSteps(e: KeyLike): number | null {
  const steps = e.shiftKey ? SHIFT_STEPS : 1;
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') return steps;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') return -steps;
  return null;
}

/** {@link arrowSteps} plus the Page keys (ten steps) and Home and End (an end of the
 *  range): what a slider thumb answers to. Under `'rtl'` ArrowLeft steps up and ArrowRight
 *  down, as a native range input's do. `null` for any other key. */
export function keyMoveOf(e: KeyLike, direction: 'ltr' | 'rtl' = 'ltr'): number | 'home' | 'end' | null {
  switch (e.key) {
    case 'PageUp':
      return SHIFT_STEPS;
    case 'PageDown':
      return -SHIFT_STEPS;
    case 'Home':
      return 'home';
    case 'End':
      return 'end';
    default: {
      const steps = arrowSteps(e);
      const horizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      return steps !== null && horizontal && direction === 'rtl' ? -steps : steps;
    }
  }
}

/** Steps an arrow key asks for on a plane, in screen axes: `dy` is positive toward ArrowDown.
 *  One step, or ten with shift; `null` for any other key. */
export function arrowMove(e: KeyLike): { dx: number; dy: number } | null {
  const steps = arrowSteps(e);
  if (steps === null) return null;
  return e.key === 'ArrowRight' || e.key === 'ArrowLeft' ? { dx: steps, dy: 0 } : { dx: 0, dy: -steps };
}
