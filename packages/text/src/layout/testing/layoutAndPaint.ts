import type { ResolvedRun } from '../../runs/resolveRuns';
import type { LayoutRunsOptions } from '../layoutOpts';
import { layoutRuns, type LaidOutRuns } from '../layoutRuns';
import { paintRuns, type PaintedRuns, type PaintRunsOptions } from '../paintRuns';

/** A layout and what `paintRuns` draws for it, as one object, for a test that
 *  reads both. */
export function layoutAndPaint(
  runs: readonly ResolvedRun[],
  opts: LayoutRunsOptions & PaintRunsOptions,
): LaidOutRuns & PaintedRuns {
  const { outlineMinSize, ...layout } = opts;
  const laid = layoutRuns(runs, layout);
  return { ...laid, ...paintRuns(laid, runs, { outlineMinSize }) };
}
