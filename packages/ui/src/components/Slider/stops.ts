import { decimal } from '@weasel-js/quantity';
import type { BoundsCtx, Thumb } from './types';

/** How close a drag has to come to a stop, in track pixels, to land on it. */
export const STOP_SNAP_PX = 8;

export function resolveBounds(thumb: Thumb, ctx: BoundsCtx, fallbackMin: number, fallbackMax: number): [number, number] {
  if (!thumb.bounds) return [fallbackMin, fallbackMax];
  const tuple = typeof thumb.bounds === 'function' ? thumb.bounds(ctx) : thumb.bounds;
  return [tuple[0], tuple[1]];
}

/** Where fraction `f` of the value span falls in a box as wide as the track.
 *  The rail element is laid out from the same `--rp-thumb-inset`. */
export function fractionToPosition(f: number): string {
  return `calc(var(--rp-thumb-inset) + ${f} * (100% - 2 * var(--rp-thumb-inset)))`;
}

export const READOUT = decimal({ places: 3 });
