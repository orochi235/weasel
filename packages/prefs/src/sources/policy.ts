// The one reset policy every params surface runs: what a reset reaches, and whether a leaf already is at it.
// `resetPlans` says what the reset writes; a source says what it reads.

import { readingIsAtReset, resetPlans, type LeafReading, type ResetWrite } from '../autoReset';
import type { PrefLeaf } from '@weasel-js/prefs-schema';
import type { PrefsSource } from './prefsSource';

/** What a reset reads of `source`: nothing for a leaf an `enableIf` disables, which no reset reaches. */
export function resetReader(source: Pick<PrefsSource, 'stateAt' | 'valueAt'>): (path: string) => LeafReading | undefined {
  return (path) => (!source.stateAt(path).enabled ? undefined : source.valueAt(path));
}

/** The writes a reset of the leaves and groups at `paths` makes in `source`. */
export function sourceResetPlan(source: Pick<PrefsSource, 'schema' | 'stateAt' | 'valueAt'>, paths: readonly string[]): ResetWrite[] {
  return resetPlans(source.schema, paths, resetReader(source));
}

/** Whether every leaf at or under `path` already is as a reset leaves it. */
export function sourceIsAtReset(source: Pick<PrefsSource, 'schema' | 'stateAt' | 'valueAt'>, path: string): boolean {
  return sourceResetPlan(source, [path]).length === 0;
}

/** Whether the leaf at `path` already is as a reset leaves it, disabled or not: what a row's own reset reads. */
export function sourceLeafIsAtReset(source: Pick<PrefsSource, 'valueAt'>, path: string, leaf: PrefLeaf): boolean {
  return readingIsAtReset(leaf, source.valueAt(path));
}

/** Runs `plan` through `write`, one call per leaf. */
export function writeResetPlan(plan: readonly ResetWrite[], write: (path: string, value: unknown) => void): void {
  for (const { path, value } of plan) write(path, value);
}
