import type { CSSProperties } from 'react';
import type { TrackRun } from '@weasel-js/geom';

/** The custom properties that put a part `g` along `run`, tipped to it and turned on by `turn` degrees; `onRun.module.css`
 *  reads them. Past either end (`g` below 0 or above 1) the part carries on straight along that end, tipped as it is. */
export function placeOnRun(run: TrackRun, g: number, turn = 0): CSSProperties {
  const { point, tangent, angle } = run.at(g);
  const past = g < 0 ? g * run.length : g > 1 ? (g - 1) * run.length : 0;
  const x = point.x + past * tangent.x;
  const y = point.y + past * tangent.y;
  return { '--at-x': `${x}px`, '--at-y': `${y}px`, '--at-angle': `${angle + turn}deg` } as CSSProperties;
}
