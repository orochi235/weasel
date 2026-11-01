import { COARSE_STEPS } from '@weasel-js/quantity';
import { arrowDir } from './list';

export { COARSE_STEPS };

/** Steps an arrow key asks for along one axis: one, or {@link COARSE_STEPS} with Shift, positive
 *  toward ArrowRight and ArrowUp. Under `'rtl'` ArrowLeft and ArrowRight swap, as a native range
 *  input's do. `null` for any other key. A caller multiplies by its own step. */
export function arrowSteps(key: string, shift: boolean, dir: 'ltr' | 'rtl' = 'ltr'): number | null {
  const steps = shift ? COARSE_STEPS : 1;
  if (key === 'ArrowUp') return steps;
  if (key === 'ArrowDown') return -steps;
  const d = arrowDir(key, { orientation: 'horizontal', dir });
  return d === 0 ? null : d * steps;
}

/** Steps an arrow key asks for on a plane, in screen axes: `dy` is positive toward ArrowDown.
 *  One step, or {@link COARSE_STEPS} with Shift; `null` for any other key. */
export function arrowMove(key: string, shift: boolean): { dx: number; dy: number } | null {
  const steps = arrowSteps(key, shift);
  if (steps === null) return null;
  return key === 'ArrowRight' || key === 'ArrowLeft' ? { dx: steps, dy: 0 } : { dx: 0, dy: -steps };
}

/** What a key does along a range: {@link arrowSteps}, the Page keys ({@link COARSE_STEPS} steps),
 *  or Home and End (an end of the range). `null` for any other key. */
export function rangeKey(key: string, shift: boolean, dir: 'ltr' | 'rtl' = 'ltr'): number | 'home' | 'end' | null {
  switch (key) {
    case 'PageUp': return COARSE_STEPS;
    case 'PageDown': return -COARSE_STEPS;
    case 'Home': return 'home';
    case 'End': return 'end';
    default: return arrowSteps(key, shift, dir);
  }
}
