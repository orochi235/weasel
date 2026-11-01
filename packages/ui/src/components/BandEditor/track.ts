import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { arrowSteps } from '@weasel-js/ui-logic';
import { clamp01 } from './scale';

/** One arrow-key step, as a fraction of the track. */
const KEY_STEP = 0.01;

/** How far an arrow key moves a handle, as a fraction of the track; `shift` takes ten steps. `null` for any other key. */
export function arrowStep(e: ReactKeyboardEvent): number | null {
  const steps = arrowSteps(e.key, e.shiftKey);
  return steps === null ? null : steps * KEY_STEP;
}

export function pct(unit: number): string {
  return `${clamp01(unit) * 100}%`;
}
