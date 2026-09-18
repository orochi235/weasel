import { useMemo } from 'react';
import { resolveAutoConfig } from './autoConfig';
import type { ResolvedConfig } from './types';

const NONE: ReadonlySet<string> = new Set();

/**
 * The config an instrument reads: the stored one with every unpinned path
 * resolved. The single place resolution happens, so `Trial` and
 * `useTrialState` cannot disagree about what an instrument is looking at.
 */
export function useResolvedConfig<TC>(
  schema: ResolvedConfig | undefined,
  config: TC,
  autoPaths: readonly string[] | undefined,
): { config: TC; auto: ReadonlySet<string> } {
  const auto = useMemo(
    () => (autoPaths && autoPaths.length > 0 ? new Set(autoPaths) : NONE),
    [autoPaths],
  );
  const resolvedConfig = useMemo(
    () => (schema ? resolveAutoConfig(schema, config, auto) : config),
    [schema, config, auto],
  );
  return { config: resolvedConfig, auto };
}
