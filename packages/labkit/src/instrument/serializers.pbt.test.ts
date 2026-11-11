/**
 * Properties of the per-instrument hooks a lab store keeps by instrument name: a stored trial or snapshot comes back
 * through exactly its own instrument's migration, defaults, and deserializer, and goes out through exactly its own
 * serializer, whatever the instruments are called, keys every object inherits among them.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { f } from '../config/builder';
import { KEYS, runs, tally, timeoutFor } from '../pbt.fixture';
import { serializeTrials } from '../state/helpers';
import { hydrateSnapshots, hydrateTrials } from '../state/hydrate';
import { loadedFrom, snapshotOf } from '../state/snapshots';
import type { InstrumentHooks, SavedSnapshot, SerializedTrial } from '../state/types';
import {
  configDefaultsOf,
  configMigrationsOf,
  configSchemasOf,
  serializersOf,
} from './serializers';
import type { Instrument, InstrumentList } from './types';

const RUNS = 150;

interface Spec {
  name: string;
  serialize: boolean;
  deserialize: boolean;
  migrate: boolean;
  schema: boolean;
}

const specs: fc.Arbitrary<Spec[]> = fc.uniqueArray(
  fc.record({
    name: fc.constantFrom(...KEYS, 'hasOwnProperty', 'valueOf'),
    serialize: fc.boolean(),
    deserialize: fc.boolean(),
    migrate: fc.boolean(),
    schema: fc.boolean(),
  }),
  { selector: (s) => s.name, minLength: 1, maxLength: 5 },
);

function instrumentOf(s: Spec): Instrument {
  return {
    name: s.name,
    defaultConfig: () => ({ base: s.name }),
    ...(s.schema ? { config: f.schema({ base: f.string(s.name) }) } : {}),
    ...(s.serialize ? { serialize: (state: unknown) => ({ out: s.name, state }) } : {}),
    ...(s.deserialize ? { deserialize: (data: unknown) => ({ in: s.name, data }) } : {}),
    ...(s.migrate
      ? { migrateConfig: (stored: unknown) => ({ ...(stored as object), moved: s.name }) }
      : {}),
    render: () => null,
  } as unknown as Instrument;
}

function hooksFor(list: InstrumentList): InstrumentHooks {
  return {
    serializers: serializersOf(list),
    configDefaults: configDefaultsOf(list),
    configMigrations: configMigrationsOf(list),
    configSchemas: configSchemasOf(list),
  };
}

const stored = (s: Spec, i: number): SerializedTrial => ({
  id: `t${i}`,
  instrumentName: s.name,
  config: { kept: i },
  state: { n: i },
  view: null,
});

const expectedConfig = (s: Spec, i: number) => ({
  base: s.name,
  kept: i,
  ...(s.migrate ? { moved: s.name } : {}),
});

describe("an instrument's hooks, by its name", () => {
  it(
    'are each own entries, present exactly for the instruments that declare them',
    () => {
      const t = tally();
      fc.assert(
        fc.property(specs, (list) => {
          const hooks = hooksFor(list.map(instrumentOf));
          const own = (r: object) => Object.keys(r).sort();
          const names = (keep: (s: Spec) => boolean) =>
            list
              .filter(keep)
              .map((s) => s.name)
              .sort();
          expect(own(hooks.serializers)).toEqual(names((s) => s.serialize || s.deserialize));
          expect(own(hooks.configMigrations)).toEqual(names((s) => s.migrate));
          expect(own(hooks.configSchemas)).toEqual(names((s) => s.schema));
          expect(own(hooks.configDefaults)).toEqual(names(() => true));
          for (const r of Object.values(hooks))
            expect(Object.getPrototypeOf(r)).toBe(Object.prototype);
          if (list.some((s) => s.name === '__proto__')) t.count('__proto__');
        }),
        runs(RUNS),
      );
      t.atLeast('__proto__', RUNS / 10);
    },
    timeoutFor(RUNS, 2),
  );

  it(
    "bring a stored trial and snapshot back through exactly their own instrument's, and send them out the same way",
    () => {
      const t = tally();
      fc.assert(
        fc.property(specs, (list) => {
          const hooks = hooksFor(list.map(instrumentOf));
          const failed: unknown[] = [];
          const trials = hydrateTrials(list.map(stored), hooks.serializers, hooks, (r) =>
            failed.push(r),
          );
          expect(failed).toEqual([]);
          expect(trials).toHaveLength(list.length);
          list.forEach((s, i) => {
            const trial = trials[i];
            expect(trial?.config).toEqual(expectedConfig(s, i));
            expect(trial?.state).toEqual(s.deserialize ? { in: s.name, data: { n: i } } : { n: i });
            if (s.name === 'constructor' || s.name === 'toString') t.count('inherited');
          });
          const out = serializeTrials(trials, hooks.serializers);
          list.forEach((s, i) => {
            const state = trials[i]?.state;
            expect(out[i]?.state).toEqual(s.serialize ? { out: s.name, state } : state);
          });

          const saves: SavedSnapshot[] = list.map((s, i) => ({
            id: `s${i}`,
            name: 'snap',
            trialId: `t${i}`,
            instrumentName: s.name,
            config: { kept: i },
            state: { n: i },
            savedAt: i,
          }));
          const snaps = hydrateSnapshots(saves, hooks, (r) => failed.push(r));
          expect(failed).toEqual([]);
          list.forEach((s, i) => {
            expect(snaps[i]?.config).toEqual(expectedConfig(s, i));
            const trial = trials[i];
            if (!trial) throw new Error('no trial');
            const snap = snapshotOf(trial, 'again', hooks, []);
            expect(snap.state).toEqual(
              s.serialize ? { out: s.name, state: trial.state } : trial.state,
            );
            const loaded = loadedFrom(trial, snap, hooks);
            expect(loaded.state).toEqual(
              s.deserialize ? { in: s.name, data: snap.state } : snap.state,
            );
          });
        }),
        runs(RUNS),
      );
      t.atLeast('inherited', RUNS / 4);
    },
    timeoutFor(RUNS, 4),
  );
});
