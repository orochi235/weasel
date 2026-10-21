import type { CSSProperties } from 'react';
import type { TrackRun } from '@weasel-js/geom';
import type { RunAlign } from '../Along/alongContext';

/** Where one item of a run falls: its center along the run, and how much of it lies past the run's ends. */
export interface RunSpot {
  center: number;
  clipped: 'none' | 'part' | 'past';
}

/** Where each item's center falls along a run `room` px long, gaps measured along it. Past `room` with `offset`, items are laid from the start less `offset`. */
export function runPlaces(lengths: readonly number[], gap: number, room: number, align: RunAlign, offset: number): RunSpot[] {
  const total = runLength(lengths, gap);
  const fits = total <= room;
  let at = !fits ? -offset : align === 'start' ? 0 : align === 'end' ? room - total : (room - total) / 2;
  return lengths.map((length) => {
    const lo = at;
    const hi = at + length;
    at = hi + gap;
    const clipped = fits || (lo >= 0 && hi <= room) ? 'none' : hi <= 0 || lo >= room ? 'past' : 'part';
    return { center: lo + length / 2, clipped };
  });
}

/** How long items of `lengths` are laid end to end with `gap` between each two. */
export function runLength(lengths: readonly number[], gap: number): number {
  return lengths.reduce((sum, length, i) => sum + length + (i > 0 ? gap : 0), 0);
}

/** The custom properties that set an item `center` px along `run`, tipped to it. */
export function placeAlong(run: TrackRun, center: number): CSSProperties {
  const { point, angle } = run.at(run.length > 0 ? center / run.length : 0.5);
  return { '--at-x': `${point.x}px`, '--at-y': `${point.y}px`, '--at-angle': `${angle}deg` } as CSSProperties;
}
