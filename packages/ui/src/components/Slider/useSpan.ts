import { useCallback, useMemo } from 'react';
import { clamp } from '@weasel-js/geom';
import { useKitSetting } from '@weasel-js/react';
import { evenMap, sliderAt, usableStops, type TrackMap } from '@weasel-js/ui-logic';
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
  /** Where the step grid starts. Default the span's `min`; an endless low end's stop sits off the grid, before it. */
  stepOrigin?: number;
}

/** The two-way map between a value and its 0..1 place along `span`, and the
 *  value a pointer at a place chooses once step and stops have had their say. */
export function useScale(span: ReturnType<typeof useSpan>, strict: boolean, step: number | undefined, options: ScaleOptions = {}) {
  const { stops, even, min, max } = span;
  const { scale = linearScale } = options;
  const origin = options.stepOrigin ?? min;
  const kitSnapPx = useKitSetting('targets.sliderStopSnapPx');
  const stopSnapPx = options.stopSnapPx ?? kitSnapPx ?? STOP_SNAP_PX;

  // No scale is built under `even`: the stops place values there, and a log scale would throw on a first stop of 0.
  const map = useMemo((): TrackMap => {
    if (even) return evenMap(stops);
    const unit = scale({ domain: [min, max], range: [0, 1] });
    return { toFraction: (v) => clamp(unit.map(v), 0, 1), toValue: (f) => unit.invert(clamp(f, 0, 1)) };
  }, [scale, even, stops, min, max]);

  const valueToFraction = useCallback((v: number): number => (max === min ? 0 : map.toFraction(v)), [map, min, max]);
  const fractionToValue = map.toValue;

  /** The value a pointer at track fraction `f` chooses, before bounds. `free` passes magnetic stops by. */
  const valueAt = useCallback(
    (f: number, length: number, free = false): number => sliderAt(f, {
      min, max, step, origin, stops, strict, free, pull: stopSnapPx / length, toFraction: valueToFraction, toValue: fractionToValue,
    }),
    [fractionToValue, valueToFraction, strict, stops, step, origin, min, max, stopSnapPx],
  );

  return { valueToFraction, fractionToValue, valueAt };
}
