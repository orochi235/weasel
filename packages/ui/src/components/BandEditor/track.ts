import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { clamp01 } from './scale';

/** One arrow-key step, as a fraction of the track. */
const KEY_STEP = 0.01;

/** How far an arrow key moves a handle, as a fraction of the track; `shift` takes ten steps. `null` for any other key. */
export function arrowStep(e: ReactKeyboardEvent): number | null {
  const step = e.shiftKey ? KEY_STEP * 10 : KEY_STEP;
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') return step;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') return -step;
  return null;
}

export function pct(unit: number): string {
  return `${clamp01(unit) * 100}%`;
}
