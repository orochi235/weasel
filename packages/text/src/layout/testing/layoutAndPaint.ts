import type { ResolvedRun } from '../../runs/resolveRuns';
import type { LayoutRunsOpts } from '../layoutOpts';
import { layoutRuns, type LaidOutRuns } from '../layoutRuns';
import { paintRuns, type PaintedRuns, type PaintRunsOpts } from '../paintRuns';

/** A layout and what `paintRuns` draws for it, as one object, for a test that
 *  reads both. */
export function layoutAndPaint(
  runs: readonly ResolvedRun[],
  opts: LayoutRunsOpts & PaintRunsOpts,
): LaidOutRuns & PaintedRuns {
  const { outlineMinSize, ...layout } = opts;
  const laid = layoutRuns(runs, layout);
  return { ...laid, ...paintRuns(laid, runs, { outlineMinSize }) };
}
