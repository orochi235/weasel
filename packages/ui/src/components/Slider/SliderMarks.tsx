import type { ReactElement } from 'react';
import on from '../Along/onRun.module.css';
import s from './Slider.module.css';
import type { SliderGeometry } from './sliderGeometry';
import type { SliderProps, SliderStop } from './types';

/** One tick per stop, each at its place along the span. */
export function SliderTicks({ stops, valueToFraction, geometry }: {
  stops: readonly number[];
  valueToFraction: (v: number) => number;
  geometry: SliderGeometry;
}): ReactElement {
  return (
    <div className={s.ticks} data-slider-ticks aria-hidden="true">
      {stops.map(v => {
        const f = valueToFraction(v);
        return <span key={v} className={geometry.curved ? `${s.tick} ${on.onRun}` : s.tick} data-slider-tick data-fraction={String(f)} style={geometry.place(f)} />;
      })}
    </div>
  );
}

/** A stop with the position it holds in the stop list, which tells an end from the middle. */
export interface LabeledStop {
  stop: SliderStop;
  i: number;
}

/** The stops whose labels `mode` shows. */
export function labeledStopsOf(stopList: readonly SliderStop[], mode: NonNullable<SliderProps['stopLabels']>): LabeledStop[] {
  if (mode === 'none') return [];
  const last = stopList.length - 1;
  return stopList
    .map((stop, i) => ({ stop, i }))
    .filter(({ stop, i }) => stop.label !== undefined && (mode === 'all' || i === 0 || i === last));
}

/** Which edge of a straight track a stop at fraction `f` stands at, if either. */
function edgeOf(f: number, direction: 'ltr' | 'rtl'): 'left' | 'right' | undefined {
  if (f !== 0 && f !== 1) return undefined;
  return (f === 0) === (direction === 'ltr') ? 'left' : 'right';
}

/** The labels under their stops. Inside the track so it shares the track's width, not the row's: an inline
 *  readout beside the track would otherwise shift every label off its stop. On a curve an end label is not
 *  held to the track's edge, which a curve does not have. */
export function SliderStopLabels({ labeled, selected, valueToFraction, geometry }: {
  labeled: readonly LabeledStop[];
  selected: readonly number[];
  valueToFraction: (v: number) => number;
  geometry: SliderGeometry;
}): ReactElement {
  return (
    <div className={s.stopLabels} data-slider-stop-labels aria-hidden="true">
      {labeled.map(({ stop }) => (
        <span
          key={stop.value}
          className={geometry.curved ? `${s.stopLabel} ${on.onRun}` : s.stopLabel}
          data-slider-stop-label
          data-selected={selected.includes(stop.value) ? 'true' : undefined}
          data-edge={geometry.curved ? undefined : edgeOf(valueToFraction(stop.value), geometry.direction)}
          style={geometry.place(valueToFraction(stop.value))}
        >
          {stop.label}
        </span>
      ))}
    </div>
  );
}
