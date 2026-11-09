import { trackRun, type TrackRun, type TrackRunOptions, type TrackShape } from '@weasel-js/geom';

/** How {@link rowRun} reads a shape: as {@link trackRun} does, over the stretch `from..to` of it (default the whole). */
export interface RowRunOptions extends Omit<TrackRunOptions, 'direction'> {
  from?: number;
  to?: number;
}

/**
 * `shape` as a row of items laid along it reads it: from the shape's own start, so its direction sets which end the first
 * item sits at, or from its end under `'rtl'`, as the same row laid out straight would mirror. Each item still stands
 * upright, turning as the run's side says. A slider's values read it the same way, min at the start.
 */
export function rowRun(shape: TrackShape, direction: 'ltr' | 'rtl' = 'ltr', options: RowRunOptions = {}): TrackRun {
  const { from = 0, to = 1, ...run } = options;
  const against = trackRun(shape, from, to, run).reversed;
  return trackRun(shape, from, to, { ...run, direction: against !== (direction === 'rtl') ? 'rtl' : 'ltr' });
}

/** Which way a run {@link rowRun} made reads across the screen: `'rtl'` where it ends left of its start, so the arrow
 *  keys, which follow the screen, step it backward on Right. One that ends level with its start, a ring say, keeps the
 *  inline direction it was made in, which is whether it runs against the shape. */
export function screenDirection(run: TrackRun): 'ltr' | 'rtl' {
  const dx = run.at(1).point.x - run.at(0).point.x;
  if (Math.abs(dx) <= 1e-6 * Math.max(1, run.length)) return run.reversed ? 'rtl' : 'ltr';
  return dx < 0 ? 'rtl' : 'ltr';
}
