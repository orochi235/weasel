import { type LengthTable, type RectPath, lengthAtAnchor } from '@weasel-js/geom';
import { extractPolylines, type Polyline } from '@weasel-js/geom/tessellate';
import type { StrokeTrim } from '@weasel-js/paint';
import { resolveTrim } from '../trim/resolveTrim';
import { polylineTable, windowPolylines, type WindowedRun } from '../trim/windowPolylines';
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
 * by `trim` in world length, then cut by the insets and carried into
 * `ribbon`'s space. A run cut from a closed subpath takes no inset, as it takes
 * no marker. `polylines` may be mapped in place.
 */
export function windowRibbon(
  polylines: Polyline[], trim: StrokeTrim, anchorSources: Uint32Array | null | undefined,
  from: StrokeMetric | null, ribbon: StrokeMetric | null,
  startInset: InsetLength | undefined, endInset: InsetLength | undefined, dashing: boolean,
): RibbonRuns {
  if (from) for (const pl of polylines) polylineOutOfMetric(pl, from);
  const table = polylineTable(polylines, anchorSources);
  const windowed = windowPolylines(polylines, trim, anchorSources, table)!;
  const inWorld = ribbon === null && worldInset(startInset) && worldInset(endInset);
  const dashLength = !dashing ? undefined
    : inWorld ? untrimmedWorldLength(table, polylines, insetLength(startInset), insetLength(endInset))
      : polylinesLength(polylines.flatMap((pl) => trimInSpace(withOwnPoints(pl), null, ribbon, startInset, endInset) ?? []));
  // Only the first run can start mid-subpath. In world its phase is the cut's distance from
  // the subpath start, since the start inset moves both by the same; elsewhere it is measured.
  const phases = windowed.map((run) => (!dashing || run.dashPhase <= 0 || inWorld ? run.dashPhase
    : measuredPhase(polylines, table, run, resolveTrim(table, trim)!.from, anchorSources, ribbon, startInset)));
  const runs: Polyline[] = [];
  const kept: number[] = [];
  windowed.forEach(({ polyline, fromClosed }, i) => {
    const t = trimInSpace(polyline, null, ribbon, fromClosed ? undefined : startInset, fromClosed ? undefined : endInset);
    if (t !== null) { runs.push(t); kept.push(phases[i]); }
  });
  return { runs, phases: kept, dashLength };
}

/** What the untrimmed ribbon's insets leave of `polylines`, all lengths world. */
function untrimmedWorldLength(table: LengthTable, polylines: readonly Polyline[], start: number, end: number): number {
  const cut = Math.max(0, start) + Math.max(0, end);
  let sum = 0;
  polylines.forEach((pl, r) => {
    const len = table.runStart[r + 1] - table.runStart[r];
    sum += pl.closed || cut <= 0 ? len : Math.max(0, len - cut);
  });
  return sum;
}

/**
 * How far along the untrimmed, inset-cut subpath, in the ribbon's space, the
 * run cut at pen length `at` starts drawing: both measured back from the
 * subpath's end, so no point has to be found on the other.
 */
function measuredPhase(
  polylines: readonly Polyline[], table: LengthTable, run: WindowedRun, at: number,
  anchorSources: Uint32Array | null | undefined, ribbon: StrokeMetric | null, startInset: InsetLength | undefined,
): number {
  let r = 0;
  while (table.runStart[r + 1] <= at) r++;
  const inset = run.fromClosed ? undefined : startInset;
  const whole = trimInSpace(withOwnPoints(polylines[r]), null, ribbon, inset, undefined);
  const [rest] = windowPolylines(polylines, { start: { length: at }, end: { length: table.runStart[r + 1] } }, anchorSources, table)!;
  const tail = rest ? trimInSpace(withOwnPoints(rest.polyline), null, ribbon, inset, undefined) : null;
  return Math.max(0, lengthOf(whole) - lengthOf(tail));
}

const NOTHING: StrokeTrim = { start: 1, end: 0 };

/**
 * `trim` resolved on the authored `rect` and restated by anchor, for a ribbon
 * that strokes a rect shifted in or out by alignment: the two share their
 * anchors, so corners and marker heads line up and lengths read as authored.
 */
export function authoredRectTrim(rect: RectPath, trim: StrokeTrim): StrokeTrim {
  const table = polylineTable(extractPolylines(rect));
  const span = resolveTrim(table, trim);
  return span ? { start: { anchor: anchorAt(table, span.from) }, end: { anchor: anchorAt(table, span.to) } } : NOTHING;
}

/** The anchor position at pen length `s` of a single-subpath table. */
function anchorAt(t: LengthTable, s: number): number {
  for (let k = 0; k < t.segments; k++) {
    const a = lengthAtAnchor(t, k);
    const b = lengthAtAnchor(t, k + 1);
    if (s <= b || k === t.segments - 1) return b > a ? k + Math.min(1, Math.max(0, (s - a) / (b - a))) : k + 1;
  }
  return 0;
}
