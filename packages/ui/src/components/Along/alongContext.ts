import { createContext, useContext } from 'react';
import type { Point, RunAlign, TrackShape } from '@weasel-js/geom';

/** How far an arc reaches: `'<n>deg'` of turn, or `'<n>px'` along it whatever its radius, so it keeps its length as
 *  its box grows. */
export type ArcSpan = `${number}deg` | `${number}px`;

/** An arc given by its ends. */
export interface ArcEnds {
  start: number;
  end: number;
  at?: never;
  span?: never;
}

/** An arc given by the direction its middle faces and how far it reaches either side of it, in all. */
export interface ArcAround {
  at: number;
  span: ArcSpan;
  start?: never;
  end?: never;
}

/** An arc in degrees clockwise from 12 o'clock, sized from the box it is laid in: by its ends, or by its middle and
 *  span. */
export type AlongArc = (ArcEnds | ArcAround) & AlongArcPlace;

/** Where an {@link AlongArc} lies in its box, and which way it runs. */
export interface AlongArcPlace {
  /** Which way it runs from `start` to `end`, so which end a row's first item sits at; each item still stands upright.
   *  Under `rtl` a row starts from the other end. Default `'cw'`. */
  direction?: 'cw' | 'ccw';
  /** Px. Default: the box's inscribed circle, less `inset`. */
  radius?: number;
  /** Px in the box. Default: the box's center. */
  center?: Point;
  /** Px taken off the default radius; floored at 0. Default 0. */
  inset?: number;
}

/** What `Along` hands the controls inside it. */
export interface AlongCtx {
  shape: TrackShape;
  align: RunAlign;
}

export type { RunAlign };

export const AlongContext = createContext<AlongCtx | null>(null);

/** The shape of the nearest `Along`, or null outside one. */
export function useTrackShape(): AlongCtx | null {
  return useContext(AlongContext);
}
