import type { ConfigSchema } from '../config/types';
import type { Instrument } from './types';

/** An instrument as it is written: either the legacy `defaultConfig` (plus an
 *  optional `configSchema`), or a `config` schema that supplies both. */
export type InstrumentSpec<TS, TC, TItem = unknown> =
  | Instrument<TS, TC, TItem>
  | (Omit<Instrument<TS, TC, TItem>, 'defaultConfig'> & { config: ConfigSchema<TC> });

/**
 * Normalizes an instrument spec, and infers its state and config types from
 * the literal rather than making them be written out.
 *
 * A spec declaring `config` gets its `defaultConfig` synthesized from the
 * schema, so nothing downstream branches on which way the config was
 * declared. A spec written the legacy way is returned unchanged, by
 * reference.
 *
 * Resolving the schema into controls does not happen here: rules are
 * lab-scoped and this runs at module load. `useConfigSchema` does that.
 *
 * TypeScript infers all three type arguments or none, so a call that names
 * `TS` and `TC` leaves `TItem` at `unknown` and a job's `onItem` needs a cast.
 * Name the item type too, or pass no type arguments at all.
 */
export function defineInstrument<TS, TC, TItem = unknown>(
  spec: InstrumentSpec<TS, TC, TItem>,
): Instrument<TS, TC, TItem> {
  if (spec.config && !('defaultConfig' in spec && spec.defaultConfig)) {
    const schema = spec.config;
    return { ...spec, defaultConfig: () => schema.defaults() } as Instrument<TS, TC, TItem>;
  }
  return spec as Instrument<TS, TC, TItem>;
}
