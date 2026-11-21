import { clamp01 } from '@weasel-js/geom';

/** One key step along a band editor's track, as a fraction of it. */
export const KEY_STEP = 0.01;

export function pct(unit: number): string {
  return `${clamp01(unit) * 100}%`;
}
