import { fillConfigDefaults } from '../config/path';
import { deserializeTrials } from './helpers';
import type {
  CreateLabStoreOptions,
  InstrumentSerializers,
  SavedSnapshot,
  SerializedTrial,
  TrialRecord,
} from './types';

/** How a stored config is brought up to date on the way in. */
export type ConfigHydration = Pick<CreateLabStoreOptions, 'configDefaults' | 'configMigrations'>;

function hydratedConfig(
  hydration: ConfigHydration,
  instrumentName: string,
  config: unknown,
): unknown {
  return filledConfig(hydration, instrumentName, migratedConfig(hydration, instrumentName, config));
}

function migratedConfig(
  hydration: ConfigHydration,
  instrumentName: string,
  config: unknown,
): unknown {
  const migrate = hydration.configMigrations?.[instrumentName];
  return migrate ? migrate(config) : config;
}

function filledConfig(hydration: ConfigHydration, instrumentName: string, moved: unknown): unknown {
  const defaults = hydration.configDefaults?.[instrumentName];
  return defaults ? fillConfigDefaults(moved, defaults()) : moved;
}

/** Rebuild stored trials: migrate each config, fill its gaps from its
 *  instrument's defaults, then run the deserializer against the result. A
 *  trial either step throws on is left out, with a warning. */
export function hydrateTrials(
  trials: SerializedTrial[],
  serializers: InstrumentSerializers,
  hydration: ConfigHydration = {},
): TrialRecord[] {
  return trials.flatMap((t) =>
    hydrated('trial', t, () =>
      deserializeTrials(
        [{ ...t, config: hydratedConfig(hydration, t.instrumentName, t.config) }],
        serializers,
      ),
    ),
  );
}

/** Bring each stored snapshot's config up to date the way `hydrateTrials` does a trial's. */
export function hydrateSnapshots(
  saves: SavedSnapshot[],
  hydration: ConfigHydration = {},
): SavedSnapshot[] {
  return saves.flatMap((sn) =>
    hydrated('snapshot', sn, () => [
      { ...sn, config: hydratedConfig(hydration, sn.instrumentName, sn.config) },
    ]),
  );
}

/**
 * A held trial or snapshot with its config brought up to date for an instrument set after it was
 * loaded. One whose stored config the migration throws on comes back as it is: left out of the
 * state, its record would be deleted. A throwing default config is the instrument's fault for
 * every trial, and is thrown.
 */
export function rehydrated<T extends { id: string; instrumentName: string; config: unknown }>(
  what: string,
  held: T,
  hydration: ConfigHydration,
): T {
  const [moved] = hydrated(what, held, () => [
    { config: migratedConfig(hydration, held.instrumentName, held.config) },
  ]);
  if (!moved) return held;
  return { ...held, config: filledConfig(hydration, held.instrumentName, moved.config) };
}

function hydrated<T>(
  what: string,
  stored: { id: string; instrumentName: string },
  build: () => T[],
): T[] {
  try {
    return build();
  } catch (error) {
    console.warn(
      `[labkit] ${what} "${stored.id}" (${stored.instrumentName}) failed to load; leaving its record alone`,
      error,
    );
    return [];
  }
}
