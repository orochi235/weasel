import { clamp, clamp01 } from '@weasel-js/geom';
import { snapToStep, spinKey } from '@weasel-js/quantity';
import { arrowSteps, usableStops } from '@weasel-js/ui-logic';
import type { ContinuousScaleFactory } from '@weasel-js/plot/scales';
import { catchStop } from './sliderStops';

/**
 * Where a native range input runs. A linear track runs in value units and
 * leaves stepping to the input; a scaled one runs along 0..1, and `fromInput`
 * puts a position back into value units on `step`'s grid or on a stop, which
 * `keyStep` moves by a step in value units, as the readout does.
 */
export interface TrackPlace {
  min: number;
  max: number;
  step: number | 'any';
  toInput: (value: number) => number;
  fromInput: (raw: number) => number;
  /** A value's place along the track, 0..1. */
  fraction: (value: number) => number;
  /** Where an arrow, Page, Home or End key moves `value`; `null` for another key, or a linear track, whose input
   *  steps itself. Left and Right step as Down and Up, mirrored under `'rtl'`, as the native input's do. */
  keyStep: (key: string, value: number, dir?: 'ltr' | 'rtl') => number | null;
}

/** The native range over `min`..`max`, spaced by `scale` where one is given. */
export function trackPlace(
  scale: ContinuousScaleFactory | undefined,
  min: number,
  max: number,
  step: number,
  stops: readonly number[] | undefined,
): TrackPlace {
  if (!scale || max === min) {
    return {
      min, max, step,
      toInput: (v) => v,
      fromInput: (raw) => raw,
      fraction: (v) => (v - min) / (max - min || 1),
      keyStep: () => null,
    };
  }
  const unit = scale({ domain: [min, max], range: [0, 1] });
  const at = usableStops(stops, min, max).map((s) => s.value);
  const toInput = (v: number) => clamp01(unit.map(v));
  const fromInput = (raw: number): number => {
    if (raw <= 0) return min;
    if (raw >= 1) return max;
    // A stop off the step grid is put back where it sat, as an input running in value units would.
    let stop: number | undefined;
    let gap = 1e-9;
    for (const s of at) {
      const d = Math.abs(toInput(s) - raw);
      if (d < gap) { stop = s; gap = d; }
    }
    return stop ?? clamp(snapToStep(unit.invert(raw), step, min), min, max);
  };
  return {
    min: 0, max: 1, step: 'any',
    toInput, fromInput, fraction: toInput,
    keyStep: (key, value, dir = 'ltr') => {
      const steps = key === 'ArrowLeft' || key === 'ArrowRight' ? arrowSteps(key, false, dir) : null;
      const spun = spinKey(steps === null ? key : steps > 0 ? 'ArrowUp' : 'ArrowDown', value, { step, min, max });
      return spun === null ? null : catchStop(value, spun, at);
    },
  };
}
