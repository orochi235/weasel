import { useContext, useMemo } from 'react';
import type { Instrument } from '../instrument/types';
import { LabContext } from '../lab/LabContext';
import { fromConfigFields } from './fromConfigField';
import { resolveConfigSchema } from './resolve';
import type { ResolvedConfig } from './types';

const NO_RULES: readonly [] = [];

/**
 * An instrument's controls, resolved against the surrounding lab's rules.
 *
 * Resolution cannot happen in `defineInstrument` — rules are lab-scoped and
 * that runs at module load — so it happens here, at render. Both instrument
 * paths land in the same shape, so callers never branch on which was used.
 */
export function useConfigSchema(
  // biome-ignore lint/suspicious/noExplicitAny: instruments are stored contravariantly; see InstrumentList
  instrument: Instrument<any, any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
): ResolvedConfig {
  const lab = useContext(LabContext);
  const rules = lab?.configRules ?? NO_RULES;
  return useMemo(
    () =>
      instrument.config
        ? resolveConfigSchema(instrument.config, rules)
        : fromConfigFields(instrument.configSchema?.() ?? []),
    [instrument, rules],
  );
}
