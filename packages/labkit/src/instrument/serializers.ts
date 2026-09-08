import type { InstrumentSerializers } from '../state/types';
import type { InstrumentList } from './types';

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
