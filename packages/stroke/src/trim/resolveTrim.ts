import {
  lengthAtAnchor, lengthAtSegmentFraction, lengthAtSubpath, type LengthSpan, type LengthTable,
} from '@weasel-js/geom';
import type { StrokeTrim, TrimAt, TrimPace } from '@weasel-js/paint';

/**
 * The stretch of `t`'s path a trim draws, as pen-order lengths, or null when
 * it draws nothing: a window starting at or past its end, or a position that
 * is NaN. Positions clamp to the path; no trim is `{}`, the whole of it.
 */
export function resolveTrim(t: LengthTable, trim: StrokeTrim | undefined): LengthSpan | null {
  const { start = 0, end = 1, pace = 'length' } = trim ?? {};
  const from = lengthOf(t, start, pace);
  const to = lengthOf(t, end, pace);
  if (Number.isNaN(from) || Number.isNaN(to) || from >= to) return null;
  return { from, to };
}

function lengthOf(t: LengthTable, at: TrimAt, pace: TrimPace): number {
  if (typeof at === 'number') {
    return pace === 'anchor' ? lengthAtSegmentFraction(t, at) : clampLength(t, at * t.total);
  }
  if ('length' in at) return clampLength(t, at.length);
  if ('anchor' in at) return lengthAtAnchor(t, at.anchor);
  return lengthAtSubpath(t, at.subpath);
}

const clampLength = (t: LengthTable, s: number): number => (Number.isNaN(s) ? NaN : Math.min(Math.max(s, 0), t.total));
