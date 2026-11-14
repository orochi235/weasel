// The one reset policy every params surface runs: what a reset reaches, and whether a leaf already is at it.
// `resetPlanAt` (`@weasel-js/prefs`) says what the reset writes; a source says what it reads.

import {
  leafIsAtReset,
  resetPlanAt,
  type LeafReading,
  type PrefLeaf,
  type ResetWrite,
} from '@weasel-js/prefs';
import type { PrefsSource } from './PrefsSource';
import type { LeafContext } from './types';

/** What a reset reads of `source`: nothing for a leaf an `enableIf` disables, which no reset reaches. */
export function resetReading(source: PrefsSource): (path: string) => LeafReading | undefined {
  return (path) => (source.stateAt(path).disabled ? undefined : source.valueAt(path));
}

/** The writes a reset of the leaves and groups at `paths` makes in `source`. */
export function sourceResetPlan(source: Pick<PrefsSource, 'schema' | 'stateAt' | 'valueAt'>, paths: readonly string[]): ResetWrite[] {
  return resetPlanAt(source.schema, paths, resetReading(source as PrefsSource));
}

/** Whether every leaf at or under `path` already is as a reset leaves it. */
export function sourceIsAtReset(source: PrefsSource, path: string): boolean {
  return sourceResetPlan(source, [path]).length === 0;
}

/** Whether the leaf at `path` already is as a reset leaves it, disabled or not: what a row's own reset reads. */
export function leafAtReset(source: PrefsSource, path: string, leaf: PrefLeaf): boolean {
  return leafIsAtReset(leaf, source.valueAt(path));
}

/** Runs `plan` through `write`, one call per leaf. */
export function writePlan(plan: readonly ResetWrite[], write: (path: string, value: unknown) => void): void {
  for (const { path, write: value } of plan) write(path, value);
}

/**
 * The part of a {@link LeafContext} the source answers: the reading, the conditions, the writes, the auto toggle
 * and the reset. A surface spreads its own extras over it.
 */
export function sourceLeafContext(source: PrefsSource, path: string, pref: PrefLeaf): LeafContext {
  const reading = source.valueAt(path);
  const state = source.stateAt(path);
  const atReset = (pref as { readout?: boolean }).readout === true || leafIsAtReset(pref, reading);
  return {
    ...reading,
    path,
    pref,
    source,
    disabled: state.disabled,
    hidden: state.hidden,
    active: state.active,
    setValue: (value) => source.write(path, value),
    update: (fn) => source.update(path, fn),
    setAuto: (next) => {
      if (reading.auto !== undefined) source.setAuto?.(path, next);
    },
    ...(atReset ? {} : { reset: () => source.reset([path]) }),
  };
}
