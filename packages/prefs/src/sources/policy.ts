// The one reset policy every params surface runs: what a reset reaches, and whether a leaf already is at it.
// `resetPlanAt` says what the reset writes; a source says what it reads.

import { leafIsAtReset, resetPlanAt, type LeafReading, type ResetWrite } from '../autoReset';
import type { PrefLeaf } from '../schema';
import type { PrefsSource } from './prefsSource';

/** What a reset reads of `source`: nothing for a leaf an `enableIf` disables, which no reset reaches. */
export function resetReading(source: Pick<PrefsSource, 'stateAt' | 'valueAt'>): (path: string) => LeafReading | undefined {
  return (path) => (source.stateAt(path).disabled ? undefined : source.valueAt(path));
}

/** The writes a reset of the leaves and groups at `paths` makes in `source`. */
export function sourceResetPlan(source: Pick<PrefsSource, 'schema' | 'stateAt' | 'valueAt'>, paths: readonly string[]): ResetWrite[] {
  return resetPlanAt(source.schema, paths, resetReading(source));
}

/** Whether every leaf at or under `path` already is as a reset leaves it. */
export function sourceIsAtReset(source: Pick<PrefsSource, 'schema' | 'stateAt' | 'valueAt'>, path: string): boolean {
  return sourceResetPlan(source, [path]).length === 0;
}

/** Whether the leaf at `path` already is as a reset leaves it, disabled or not: what a row's own reset reads. */
export function leafAtReset(source: Pick<PrefsSource, 'valueAt'>, path: string, leaf: PrefLeaf): boolean {
  return leafIsAtReset(leaf, source.valueAt(path));
}

/** Runs `plan` through `write`, one call per leaf. */
export function writePlan(plan: readonly ResetWrite[], write: (path: string, value: unknown) => void): void {
  for (const { path, write: value } of plan) write(path, value);
}
