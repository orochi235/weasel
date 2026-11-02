import type { Polyline } from '@weasel-js/geom/tessellate';
import type { StrokeTrim } from '@weasel-js/paint';
import { resolveTrim } from '../trim/resolveTrim';
import { polylineTable, windowPolylines } from '../trim/windowPolylines';
import { polylinesLength } from './dash';
import { type InsetLength, trimInSpace } from './insets';
import { type StrokeMetric, polylineIntoMetric, polylineOutOfMetric } from './metric';

/** What a trimmed ribbon strokes: its runs in the ribbon's space, each run's
 *  dash phase there, and the untrimmed length the solid-dash decision reads. */
export interface RibbonRuns {
  runs: Polyline[];
  phases: number[];
  dashLength: number | undefined;
}

const withOwnPoints = (pl: Polyline): Polyline => ({ ...pl, points: pl.points.slice() });

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
  const dashLength = dashing
    ? polylinesLength(polylines.flatMap((pl) => trimInSpace(withOwnPoints(pl), from, ribbon, startInset, endInset) ?? []))
    : undefined;
  if (from) for (const pl of polylines) polylineOutOfMetric(pl, from);
  const table = polylineTable(polylines, anchorSources);
  const windowed = windowPolylines(polylines, trim, anchorSources, table)!;
  // Only the first run can start mid-subpath; under a metric its phase is the
  // cut-off head's length in the ribbon's space, which is where dashes are measured.
  const phases = windowed.map(({ dashPhase }) => {
    if (!dashing || ribbon === null || dashPhase <= 0) return dashPhase;
    const at = resolveTrim(table, trim)!.from;
    const head = windowPolylines(polylines, { start: { length: at - dashPhase }, end: { length: at } }, anchorSources, table)!
      .map(({ polyline }) => withOwnPoints(polyline));
    for (const pl of head) polylineIntoMetric(pl, ribbon);
    return polylinesLength(head);
  });
  const runs: Polyline[] = [];
  const kept: number[] = [];
  windowed.forEach(({ polyline, fromClosed }, i) => {
    const t = trimInSpace(polyline, null, ribbon, fromClosed ? undefined : startInset, fromClosed ? undefined : endInset);
    if (t !== null) { runs.push(t); kept.push(phases[i]); }
  });
  return { runs, phases: kept, dashLength };
}
