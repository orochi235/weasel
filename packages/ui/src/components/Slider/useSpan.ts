import { useCallback, useMemo } from 'react';
import { snapToStep } from '@weasel-js/quantity';
import { clamp } from '@weasel-js/geom';
import { useKitSetting } from '@weasel-js/react';
import { attract, usableStops } from '@weasel-js/ui-logic';
import { linearScale, type ContinuousScaleFactory } from '@weasel-js/plot/scales';
import { STOP_SNAP_PX } from './stops';
import type { SliderProps } from './types';

/** The reachable stops and the value span the track runs over: the first stop
 *  to the last under `spacing: 'even'`, else `min` to `max`. */
export function useSpan(props: Pick<SliderProps, 'stops' | 'min' | 'max' | 'spacing'>) {
  const stopList = useMemo(() => usableStops(props.stops, props.min, props.max), [props.stops, props.min, props.max]);
  const stops = useMemo(() => stopList.map(stop => stop.value), [stopList]);
  const even = props.spacing === 'even' && stops.length >= 2;
  return { stopList, stops, even, min: even ? stops[0] : props.min, max: even ? stops[stops.length - 1] : props.max };
}

/** What else steers the map: a non-linear `scale`, and a stop snap distance that wins over the kit setting. */
export interface ScaleOptions {
  scale?: ContinuousScaleFactory;
  stopSnapPx?: number;
}

/** The two-way map between a value and its 0..1 place along `span`, and the
 *  value a pointer at a place chooses once step and stops have had their say. */
export function useScale(span: ReturnType<typeof useSpan>, strict: boolean, step: number | undefined, options: ScaleOptions = {}) {
  const { stops, even, min, max } = span;
  const { scale = linearScale } = options;
  const kitSnapPx = useKitSetting('targets.sliderStopSnapPx');
  const stopSnapPx = options.stopSnapPx ?? kitSnapPx ?? STOP_SNAP_PX;

  // Not built under `even`: the stops place values there, and a log scale would throw on a first stop of 0.
  const unit = useMemo(
    () => (even ? undefined : scale({ domain: [min, max], range: [0, 1] })),
    [scale, even, min, max],
  );

  const valueToFraction = useCallback(
    (v: number): number => {
      if (max === min) return 0;
      if (unit) return clamp(unit.map(v), 0, 1);
      const gaps = stops.length - 1;
      const x = clamp(v, min, max);
      let i = 0;
      while (i < gaps - 1 && x > stops[i + 1]) i++;
      return (i + (x - stops[i]) / (stops[i + 1] - stops[i])) / gaps;
    },
    [min, max, stops, unit],
  );

  const fractionToValue = useCallback(
    (f: number): number => {
      const c = clamp(f, 0, 1);
      if (unit) return unit.invert(c);
      const gaps = stops.length - 1;
      const i = Math.min(gaps - 1, Math.floor(c * gaps));
      return stops[i] + (c * gaps - i) * (stops[i + 1] - stops[i]);
    },
    [stops, unit],
  );

  /** The value a pointer at track fraction `f` chooses, before bounds. `free` passes magnetic stops by. */
  const valueAt = useCallback(
    (f: number, length: number, free = false): number => {
      const v = fractionToValue(f);
      if (strict) return attract(v, stops, Infinity, valueToFraction);
      const q = clamp(snapToStep(v, step, min), min, max);
      return stops.length > 0 && !free ? attract(q, stops, stopSnapPx / length, valueToFraction) : q;
    },
    [fractionToValue, valueToFraction, strict, stops, step, min, max, stopSnapPx],
  );

  return { valueToFraction, fractionToValue, valueAt };
}
