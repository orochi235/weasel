import type { CSSProperties } from 'react';
import type { TrackRun } from '@weasel-js/geom';

/** The custom properties that put a part `g` (0..1) along `run`, tipped to it and turned on by `turn` degrees; `onRun.module.css` reads them. */
export function placeOnRun(run: TrackRun, g: number, turn = 0): CSSProperties {
  const { point, angle } = run.at(g);
  return { '--at-x': `${point.x}px`, '--at-y': `${point.y}px`, '--at-angle': `${angle + turn}deg` } as CSSProperties;
}
