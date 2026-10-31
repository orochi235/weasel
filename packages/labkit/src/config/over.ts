import { type PrefGroup, type PrefSection, prefReader, prefSchemaHolding } from '@weasel-js/prefs';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { fillConfigDefaults, withValueAtPath } from './path';
import type { ResolvedConfig } from './types';

/**
 * Where a lab keeps the values of the schemas its instruments' configs are
 * drawn over (`f.schema(nodes, { over })`): one record by path, and its
 * writer. `<Lab over>` takes the app's, since that schema is the app's — its
 * preferences dialog edits the same values. A lab given none keeps them
 * itself, in memory, shared by every trial.
 */
export interface LabOver {
  values: Readonly<Record<string, unknown>>;
  set: (path: string, value: unknown) => void;
}

/** What an instrument is handed of the schema its config is drawn over. */
export interface OverAccess {
  /** The value at a path of that schema as its controls show it: the lab's, or the leaf's default. */
  read: (path: string) => unknown;
  /** Writes one, through the lab's `over`. */
  set: (path: string, value: unknown) => void;
}

/** The surrounding lab's `over`. Null outside a lab. */
export const LabOverContext = createContext<LabOver | null>(null);

const NO_VALUES: Readonly<Record<string, unknown>> = {};

/** `given`, or values the caller keeps for itself where it was given none. */
export function useKeptOver(given: LabOver | undefined): LabOver {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const set = useCallback(
    (path: string, value: unknown) => setValues((v) => withValueAtPath(v, path, value)),
    [],
  );
  const kept = useMemo<LabOver>(() => ({ values, set }), [values, set]);
  return given ?? kept;
}

/** The values the lab keeps for the schemas its configs are drawn over; none outside a lab. */
export function useLabOverValues(): Readonly<Record<string, unknown>> {
  return useContext(LabOverContext)?.values ?? NO_VALUES;
}

/** A trial's config with the lab's `over` values beside it, the trial's own winning: the one record a
 *  panel drawn over another schema reads both from. */
export function withOverValues(
  config: unknown,
  values: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return fillConfigDefaults(config, values) as Record<string, unknown>;
}

/** Whether a write to `path` belongs to the schema `resolved` is drawn over: no leaf of its own holds the
 *  value there, and one of that schema does. */
export function writesOver(resolved: ResolvedConfig, path: string): boolean {
  const { over, group } = resolved;
  if (over === undefined) return false;
  // Asked the other way round, `over` comes back only where a leaf of it holds the path.
  return (
    prefSchemaHolding(group, path, over) === over && prefSchemaHolding(over, path, group) === over
  );
}

/** {@link OverAccess} for `over`, read from the surrounding lab's values; none without an `over`. */
export function useOverAccess(over: PrefGroup | PrefSection | undefined): OverAccess | undefined {
  const lab = useContext(LabOverContext);
  return useMemo(() => {
    if (over === undefined) return undefined;
    const read = prefReader(over, lab?.values ?? NO_VALUES);
    return { read, set: (path: string, value: unknown) => lab?.set(path, value) };
  }, [over, lab]);
}
