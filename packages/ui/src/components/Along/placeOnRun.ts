import type { CSSProperties } from 'react';
import { runStationAt, type TrackPlace, type TrackRun } from '@weasel-js/geom';

/** The custom properties that put a part at `place`, turned on by `turn` degrees; `onRun.module.css` reads them.
 *  `--at-upright` is the half turn a part that reads takes where the place is `turned`. */
export function placeStyle(place: TrackPlace, turn = 0): CSSProperties {
  const { point, angle, turned } = place;
  return { '--at-x': `${point.x}px`, '--at-y': `${point.y}px`, '--at-angle': `${angle + turn}deg`, '--at-upright': turned ? '180deg' : '0deg' } as CSSProperties;
}

/** {@link placeStyle} for a part `g` along `run`. Past either end (`g` below 0 or above 1) the part carries on straight
 *  along that end, tipped as it is. */
export function placeOnRun(run: TrackRun, g: number, turn = 0): CSSProperties {
  return placeStyle(runStationAt(run, g * run.length), turn);
}
