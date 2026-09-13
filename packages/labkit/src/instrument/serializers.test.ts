import { describe, expect, it } from 'vitest';
import { configMigrationsOf } from './serializers';
import type { InstrumentList } from './types';

const instrument = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
  ...extra,
});

describe('configMigrationsOf', () => {
  it('keys each declared migration by instrument name, and skips the rest', () => {
    const migrations = configMigrationsOf([
      instrument('moves', { migrateConfig: (c: unknown) => ({ moved: c }) }),
      instrument('stays'),
    ] as InstrumentList);
    expect(Object.keys(migrations)).toEqual(['moves']);
    expect(migrations.moves?.({ a: 1 })).toEqual({ moved: { a: 1 } });
  });
});
