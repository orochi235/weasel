/**
 * A stored trial's config, whatever an older or foreign build left in it, loads: each value its schema describes
 * reads as a prefs store would read it, and a key no leaf describes is kept.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { f } from '../config/builder';
import { valueAtPath } from '../config/path';
import {
  configDefaultsOf,
  configMigrationsOf,
  configSchemasOf,
  serializersOf,
} from '../instrument/serializers';
import type { Instrument } from '../instrument/types';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { hydrateSnapshots, hydrateTrials } from './hydrate';
import type { InstrumentHooks, SerializedTrial } from './types';

const RUNS = 200;

const instrument = {
  name: 'Kinds',
  config: f.schema({
    n: f.number(5).range(0, 10),
    mode: f.enum('a', ['a', 'b']),
    on: f.boolean(true),
    ink: f.color('#ffffff'),
    label: f.string('x'),
    gap: f.number(),
    grid: f.group({ size: f.number(4).range(1, 8) }),
  }),
  initialState: () => ({}),
  render: () => null,
} as unknown as Instrument;

const hooks: InstrumentHooks = {
  serializers: serializersOf([instrument]),
  configDefaults: configDefaultsOf([instrument]),
  configMigrations: configMigrationsOf([instrument]),
  configSchemas: configSchemasOf([instrument]),
};

const anything = fc.oneof(
  fc.constantFrom(null, true, false, 0, -3, 7, 99, 'a', 'b', 'gone', '#123', 'red', 'nope', ''),
  fc.double(),
  fc.string({ maxLength: 4 }),
  fc.array(fc.integer(), { maxLength: 2 }),
  fc.dictionary(fc.constantFrom('size', 'x'), fc.oneof(fc.integer(), fc.string())),
);

const storedConfig = fc.dictionary(
  fc.constantFrom('n', 'mode', 'on', 'ink', 'label', 'gap', 'grid', 'retired'),
  anything,
);

const trialOf = (config: unknown): SerializedTrial => ({
  id: 't',
  instrumentName: 'Kinds',
  config,
  state: {},
  view: null,
});

function expectAdmitted(config: unknown, stored: Record<string, unknown>): void {
  const n = valueAtPath(config, 'n');
  expect(typeof n === 'number' && n >= 0 && n <= 10).toBe(true);
  expect(['a', 'b']).toContain(valueAtPath(config, 'mode'));
  expect(typeof valueAtPath(config, 'on')).toBe('boolean');
  const ink = valueAtPath(config, 'ink');
  expect(ink === '#ffffff' || (typeof ink === 'string' && ink === stored.ink)).toBe(true);
  expect(typeof valueAtPath(config, 'label')).toBe('string');
  const gap = valueAtPath(config, 'gap');
  expect(gap === undefined || typeof gap === 'number').toBe(true);
  const size = valueAtPath(config, 'grid.size');
  expect(typeof size === 'number' && size >= 1 && size <= 8).toBe(true);
}

describe('a stored config, against its schema', () => {
  it(
    'loads whatever it holds, each leaf reading a value the leaf admits and every other key kept',
    () => {
      const t = tally();
      fc.assert(
        fc.property(storedConfig, (stored) => {
          const failed: unknown[] = [];
          const trials = hydrateTrials([trialOf(stored)], hooks.serializers, hooks, (r) =>
            failed.push(r),
          );
          expect(failed).toEqual([]);
          expect(trials).toHaveLength(1);
          const config = trials[0]?.config;
          expectAdmitted(config, stored);
          if (Object.hasOwn(stored, 'retired')) {
            t.count('kept');
            expect(valueAtPath(config, 'retired')).toEqual(stored.retired);
          }
          const [snapshot] = hydrateSnapshots(
            [{ id: 's', instrumentName: 'Kinds', name: 's', config: stored, state: {} }] as never,
            hooks,
          );
          expect(snapshot?.config).toEqual(config);
          t.count(JSON.stringify(config) === JSON.stringify(stored) ? 'as stored' : 'repaired');
        }),
        runs(RUNS),
      );
      t.atLeast('repaired', RUNS / 4);
      t.atLeast('kept', RUNS / 10);
    },
    timeoutFor(RUNS, 3),
  );

  it('reads a value of the wrong kind as its default and one out of range at the nearest end', () => {
    const [trial] = hydrateTrials(
      [trialOf({ n: 'abc', mode: 'gone', on: 1, ink: 'nope', label: 4, grid: { size: 99 } })],
      hooks.serializers,
      hooks,
    );
    expect(trial?.config).toEqual({
      n: 5,
      mode: 'a',
      on: true,
      ink: '#ffffff',
      label: 'x',
      grid: { size: 8 },
    });
  });
});
