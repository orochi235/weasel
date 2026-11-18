import {
  configDefaultsOf,
  configMigrationsOf,
  configSchemasOf,
  serializersOf,
} from '../instrument/serializers';
import type { InstrumentList } from '../instrument/types';
import type { CreateLabStoreOptions, InstrumentHooks } from './types';

/** The hooks a store opens with: its instruments', or the ones its options give one by one. */
export function initialHooks(options: CreateLabStoreOptions): InstrumentHooks {
  if (options.instruments) return hooksOf(options.instruments);
  return {
    serializers: options.serializers ?? {},
    configDefaults: options.configDefaults ?? {},
    configMigrations: options.configMigrations ?? {},
    configSchemas: options.configSchemas ?? {},
  };
}

function hooksOf(instruments: InstrumentList): InstrumentHooks {
  assertUniqueNames(instruments);
  return {
    serializers: serializersOf(instruments),
    configDefaults: configDefaultsOf(instruments),
    configSchemas: configSchemasOf(instruments),
    configMigrations: configMigrationsOf(instruments),
  };
}

function assertUniqueNames(instruments: InstrumentList): void {
  const seen = new Set<string>();
  for (const { name } of instruments) {
    if (seen.has(name)) {
      throw new Error(
        `labkit: two instruments are named ${JSON.stringify(name)}. An instrument's name is the key its trials and saves are stored under, so each one in the list needs its own.`,
      );
    }
    seen.add(name);
  }
}

/** Hooks for `instruments`, keeping those of any instrument no longer listed:
 *  its trials stay open, and their state still has to round-trip. A listed
 *  name takes its hooks wholly from the new list. */
export function mergedHooks(old: InstrumentHooks, instruments: InstrumentList): InstrumentHooks {
  const listed = new Set(instruments.map((i) => i.name));
  const fresh = hooksOf(instruments);
  const unlisted = <T>(entries: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(entries).filter(([name]) => !listed.has(name)));
  return {
    serializers: { ...unlisted(old.serializers), ...fresh.serializers },
    configDefaults: { ...unlisted(old.configDefaults), ...fresh.configDefaults },
    configSchemas: { ...unlisted(old.configSchemas), ...fresh.configSchemas },
    configMigrations: { ...unlisted(old.configMigrations), ...fresh.configMigrations },
  };
}

/** The names in `instruments` that are new against `before`, or name a different object there. */
export function changedInstruments(
  before: InstrumentList | null,
  instruments: InstrumentList,
): Set<string> {
  const previous = new Map((before ?? []).map((i) => [i.name, i]));
  return new Set(instruments.filter((i) => previous.get(i.name) !== i).map((i) => i.name));
}
