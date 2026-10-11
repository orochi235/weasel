/**
 * Trimming a stroke's ends where each inset is measured.
 *
 * A head stops the line by a length in the head's own space, which need not be
 * the ribbon's: a world-sized head on a `{ px }` stroke stops it a world
 * distance short, a `{ px }` head on a world-width stroke a screen distance.
 * Under a stretching view one length means different distances in the two
 * spaces depending on which way the line runs, so each end is trimmed in its
 * own space rather than converted.
 */
import { type Polyline, trimPolyline } from '@weasel-js/geom/tessellate';
import {
  type StrokeMetric, polylineIntoMetric, polylineOutOfMetric, sameMetric,
} from './metric';

/** A length along the line measured in `metric`'s space, or in world where
 *  `metric` is `null`. */
export interface MeasuredLength {
  readonly length: number;
  readonly metric: StrokeMetric | null;
}

/** A plain number is a length in the ribbon's own space. */
export type InsetLength = number | MeasuredLength;

interface Trim {
  length: number;
  metric: StrokeMetric | null;
}

const trimOf = (inset: InsetLength | undefined, ribbon: StrokeMetric | null): Trim =>
  inset === undefined ? { length: 0, metric: ribbon }
    : typeof inset === 'number' ? { length: inset, metric: ribbon }
      : inset;

/**
 * `pl`, whose points are in `from`'s space, trimmed by `start` and `end` and
 * carried into `ribbon`'s — `null` for world in both. `pl` may be mapped in
 * place. Returns `null` when the insets consume the whole run.
 */
export function trimInSpace(
  pl: Polyline,
  from: StrokeMetric | null,
  ribbon: StrokeMetric | null,
  start: InsetLength | undefined,
  end: InsetLength | undefined,
): Polyline | null {
  const s = trimOf(start, ribbon);
  const e = trimOf(end, ribbon);
  let cur: Polyline | null = pl;
  let space = from;
  const moveTo = (to: StrokeMetric | null) => {
    if (cur === null || sameMetric(space, to)) return;
    if (space !== null) polylineOutOfMetric(cur, space);
    if (to !== null) polylineIntoMetric(cur, to);
    space = to;
  };
  if (s.length > 0 || e.length > 0) {
    if (sameMetric(s.metric, e.metric)) {
      moveTo(s.metric);
      cur = trimPolyline(cur, s.length, e.length);
    } else {
      for (const [len, metric, atStart] of [[s.length, s.metric, true], [e.length, e.metric, false]] as const) {
        if (!(len > 0) || cur === null) continue;
        moveTo(metric);
        cur = trimPolyline(cur, atStart ? len : 0, atStart ? 0 : len);
      }
    }
  }
  moveTo(ribbon);
  return cur;
}
