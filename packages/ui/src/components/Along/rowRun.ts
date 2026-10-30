import { trackRun, type TrackRun, type TrackRunOptions, type TrackShape } from '@weasel-js/geom';

/**
 * `shape` as a row of items laid along it reads it: from the shape's own start, so its direction sets which end the first
 * item sits at, or from its end under `'rtl'`, as the same row laid out straight would mirror. Each item still stands
 * upright, turning as the run's side says.
 */
export function rowRun(shape: TrackShape, direction: 'ltr' | 'rtl' = 'ltr', options: Omit<TrackRunOptions, 'direction'> = {}): TrackRun {
  const against = trackRun(shape, 0, 1, options).reversed;
  return trackRun(shape, 0, 1, { ...options, direction: against !== (direction === 'rtl') ? 'rtl' : 'ltr' });
}
