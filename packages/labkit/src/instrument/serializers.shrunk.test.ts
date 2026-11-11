/** Shrunk counterexamples from `serializers.pbt.test.ts`, kept as plain examples. */
import { describe, expect, it } from 'vitest';
import { hydrateTrials } from '../state/hydrate';
import { configDefaultsOf, configMigrationsOf, serializersOf } from './serializers';
import type { Instrument } from './types';

const instrument = (name: string) =>
  ({ name, defaultConfig: () => ({ base: name }), render: () => null }) as unknown as Instrument;

describe('an instrument named like a key every object inherits', () => {
  it('has hooks of its own, and its trials load through them', () => {
    const list = [instrument('__proto__'), instrument('a')];
    const defaults = configDefaultsOf(list);
    expect(Object.keys(defaults)).toEqual(['__proto__', 'a']);
    const failed: unknown[] = [];
    const trials = hydrateTrials(
      list.map((i, n) => ({
        id: `t${n}`,
        instrumentName: i.name,
        config: {},
        state: n,
        view: null,
      })),
      serializersOf(list),
      { configDefaults: defaults, configMigrations: configMigrationsOf(list) },
      (r) => failed.push(r),
    );
    expect(failed).toEqual([]);
    expect(trials.map((t) => t.config)).toEqual([{ base: '__proto__' }, { base: 'a' }]);
  });

  it('with no migration or serializer of its own reads none from the object prototype', () => {
    const list = [instrument('constructor'), instrument('toString')];
    const trials = hydrateTrials(
      list.map((i, n) => ({
        id: `t${n}`,
        instrumentName: i.name,
        config: { kept: n },
        state: { n },
        view: null,
      })),
      serializersOf(list),
      { configDefaults: configDefaultsOf(list), configMigrations: configMigrationsOf(list) },
    );
    expect(trials.map((t) => t.state)).toEqual([{ n: 0 }, { n: 1 }]);
    expect(trials.map((t) => t.config)).toEqual([
      { base: 'constructor', kept: 0 },
      { base: 'toString', kept: 1 },
    ]);
  });
});
