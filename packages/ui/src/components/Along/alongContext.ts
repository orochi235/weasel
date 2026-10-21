import { createContext, useContext } from 'react';
import type { Point, TrackShape } from '@weasel-js/geom';

/** An arc in degrees clockwise from 12 o'clock, sized from the box it is laid in. */
export interface AlongArc {
  start: number;
  end: number;
  direction?: 'cw' | 'ccw';
  /** Px. Default: the box's inscribed circle, less `inset`. */
  radius?: number;
  /** Px in the box. Default: the box's center. */
  center?: Point;
  /** Px taken off the default radius; floored at 0. Default 0. */
  inset?: number;
}

/** Where a control's run sits on a track longer than the run. */
export type RunAlign = 'start' | 'center' | 'end';

/** What `Along` hands the controls inside it. */
export interface AlongCtx {
  shape: TrackShape;
  align: RunAlign;
}

export const AlongContext = createContext<AlongCtx | null>(null);

/** The shape of the nearest `Along`, or null outside one. */
export function useTrackShape(): AlongCtx | null {
  return useContext(AlongContext);
}
