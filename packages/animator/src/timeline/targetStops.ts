import { travel } from '../engine/offsets';
import { stateOf, type TargetAxes } from '../target';
import type { SampledTrack } from './types';

/** A targeted track's keys in its target's axes. */
export interface TargetStops<T> {
  axes: TargetAxes<T>;
  /** One row a key. On an angle axis each carries on from the key before by the short way
   *  round, so a row may sit whole turns from the value its key names. */
  stops: number[][];
}

export function targetStops<T>(track: SampledTrack<T>): TargetStops<T> {
  const { axes } = stateOf(track.target!);
  const stops: number[][] = [];
  for (const k of track.keys) {
    const row = axes.to(k.value);
    if (row.length !== axes.count || !row.every((x) => typeof x === 'number' && !Number.isNaN(x))) {
      throw new Error("sampleTrack: a key's value is not its target's shape");
    }
    const prev = stops[stops.length - 1];
    if (prev && axes.angles) {
      const short = travel(axes, row, prev);
      for (const i of axes.angles) if (short[i] !== row[i]! - prev[i]!) row[i] = prev[i]! + short[i]!;
    }
    stops.push(row);
  }
  return { axes, stops };
}
