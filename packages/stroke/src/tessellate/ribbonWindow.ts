import type { CurvePosition, CurveSpan, LengthRun } from '@weasel-js/geom';
import type { Polyline } from '@weasel-js/geom/tessellate';
import { windowPolylines, type WindowedRun } from '../trim/windowPolylines';
import { polylinesLength } from './dash';
import { type InsetLength, trimInSpace } from './insets';
import { type StrokeMetric, polylineOutOfMetric } from './metric';

/** What a trimmed ribbon strokes: its runs in the ribbon's space, each run's
 *  dash phase there, and the untrimmed length the solid-dash decision reads. */
export interface RibbonRuns {
  runs: Polyline[];
  phases: number[];
  dashLength: number | undefined;
}

const withOwnPoints = (pl: Polyline): Polyline => ({ ...pl, points: pl.points.slice() });
const lengthOf = (pl: Polyline | null): number => (pl ? polylinesLength([pl]) : 0);
/** Whether an inset is a world length, given a world ribbon. */
const worldInset = (inset: InsetLength | undefined): boolean =>
  inset === undefined || typeof inset === 'number' || inset.metric === null;
const insetLength = (inset: InsetLength | undefined): number =>
  inset === undefined ? 0 : typeof inset === 'number' ? inset : inset.length;

/**
 * `polylines`, whose points are in `from`'s space (`null` for world), windowed
 * to `span` (`null` draws nothing) on the curve `runs` describe, then cut by
 * the insets and carried into `ribbon`'s space. A run cut from a closed
 * subpath takes no inset, as it takes no marker. `polylines` may be mapped in place.
 */
export function windowRibbon(
  polylines: Polyline[], span: CurveSpan | null, runs: readonly LengthRun[] | undefined,
  from: StrokeMetric | null, ribbon: StrokeMetric | null,
  startInset: InsetLength | undefined, endInset: InsetLength | undefined, dashing: boolean,
): RibbonRuns {
  if (from) for (const pl of polylines) polylineOutOfMetric(pl, from);
  const windowed = span ? windowPolylines(polylines, span, runs) : [];
  const inWorld = ribbon === null && worldInset(startInset) && worldInset(endInset);
  const dashLength = !dashing ? undefined
    : inWorld ? untrimmedWorldLength(polylines, insetLength(startInset), insetLength(endInset))
      : polylinesLength(polylines.flatMap((pl) => trimInSpace(withOwnPoints(pl), null, ribbon, startInset, endInset) ?? []));
  // Only the first run can start mid-subpath. In world its phase is the cut's distance from
  // the subpath start, since the start inset moves both by the same; elsewhere it is measured.
  const phases = windowed.map((run) => (!dashing || run.dashPhase <= 0 || inWorld ? run.dashPhase
    : measuredPhase(polylines, runs, run, span!.from, ribbon, startInset)));
  const out: Polyline[] = [];
  const kept: number[] = [];
  windowed.forEach(({ polyline, fromClosed }, i) => {
    const t = trimInSpace(polyline, null, ribbon, fromClosed ? undefined : startInset, fromClosed ? undefined : endInset);
    if (t !== null) { out.push(t); kept.push(phases[i]); }
  });
  return { runs: out, phases: kept, dashLength };
}

/** What the untrimmed ribbon's insets leave of `polylines`, all lengths world. */
function untrimmedWorldLength(polylines: readonly Polyline[], start: number, end: number): number {
  const cut = Math.max(0, start) + Math.max(0, end);
  let sum = 0;
  for (const pl of polylines) {
    const len = polylinesLength([pl]);
    sum += pl.closed || cut <= 0 ? len : Math.max(0, len - cut);
  }
  return sum;
}

/**
 * How far along the untrimmed, inset-cut subpath, in the ribbon's space, the
 * run cut at `at` starts drawing: both measured back from the subpath's end,
 * so no point has to be found on the other.
 */
function measuredPhase(
  polylines: readonly Polyline[], runs: readonly LengthRun[] | undefined, run: WindowedRun, at: CurvePosition,
  ribbon: StrokeMetric | null, startInset: InsetLength | undefined,
): number {
  const pl = polylines[at.run];
  const inset = run.fromClosed ? undefined : startInset;
  const whole = trimInSpace(withOwnPoints(pl), null, ribbon, inset, undefined);
  const toEnd: CurveSpan = { from: { ...at, run: 0 }, to: { run: 0, segment: Infinity, t: 1 } };
  const [rest] = windowPolylines([pl], toEnd, runs && [runs[at.run]]);
  const tail = rest ? trimInSpace(withOwnPoints(rest.polyline), null, ribbon, inset, undefined) : null;
  return Math.max(0, lengthOf(whole) - lengthOf(tail));
}
