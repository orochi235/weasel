import { resolveConfigSchema } from '../config/resolve';
import type { ResolvedConfig } from '../config/types';
import type { InstrumentSerializers } from '../state/types';
import type { Instrument, InstrumentList } from './types';

/**
 * One instrument's config schema, resolved without the lab's rules — which
 * neither the store nor a trial composed outside a lab has access to. No rule
 * can reach `autoResolve`, `unpinned` or `manual`, so for reading those the
 * two resolutions agree; anything reading the rendered leaves wants
 * `useConfigSchema` instead. `undefined` for a legacy `configSchema()`
 * instrument, which declares no auto annotations at all.
 */
export function unruledConfigSchema(
  // biome-ignore lint/suspicious/noExplicitAny: instruments are stored contravariantly; see InstrumentList
  instrument: Instrument<any, any, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
): ResolvedConfig | undefined {
  return instrument.config ? resolveConfigSchema(instrument.config, []) : undefined;
}

/** Each instrument's unruled config schema, keyed by name — what the store
 *  reads a leaf's auto annotations off. */
export function configSchemasOf(instruments: InstrumentList): Record<string, ResolvedConfig> {
  const out: Record<string, ResolvedConfig> = {};
  for (const instrument of instruments) {
    const schema = unruledConfigSchema(instrument);
    if (schema) out[instrument.name] = schema;
  }
  return out;
}

/**
 * Each instrument's default config, keyed by name — what `createLabStore`
 * fills a stored config's gaps from, so one saved before its schema grew a
 * branch still loads.
 */
export function configDefaultsOf(instruments: InstrumentList): Record<string, () => unknown> {
  const out: Record<string, () => unknown> = {};
  for (const instrument of instruments) out[instrument.name] = () => instrument.defaultConfig();
  return out;
}

/** Each instrument's `migrateConfig`, keyed by name, for those that declare one. */
export function configMigrationsOf(
  instruments: InstrumentList,
): Record<string, (stored: unknown) => unknown> {
  const out: Record<string, (stored: unknown) => unknown> = {};
  for (const { name, migrateConfig } of instruments) {
    if (migrateConfig) out[name] = (stored) => migrateConfig(stored);
  }
  return out;
}

/**
 * The `serialize` / `deserialize` an instrument list declares, keyed by
 * instrument name — what `createLabStore` needs to rebuild a trial's state
 * from storage.
 *
 * An instrument declaring neither gets no entry, which is what leaves a
 * JSON-safe state to pass through untouched.
 */
export function serializersOf(instruments: InstrumentList): InstrumentSerializers {
  const out: InstrumentSerializers = {};
  for (const instrument of instruments) {
    const { name, serialize, deserialize } = instrument;
    if (!serialize && !deserialize) continue;
    out[name] = {
      ...(serialize ? { serialize: (state: unknown) => serialize(state) } : {}),
      ...(deserialize
        ? { deserialize: (data: unknown, config: unknown) => deserialize(data, config) }
        : {}),
    };
  }
  return out;
}
