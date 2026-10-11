import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { prefHoldsValue } from './helpers';
import type { PrefLabel, PrefSeparator } from './label';
import type { PrefPath } from './paths';
import { isBuiltinPref, type PrefBoolean } from './schema';
import { createPrefsStore } from './store';

const note: PrefLabel = { kind: 'label', name: 'Applies to new shapes only.', description: '', default: undefined };
const rule: PrefSeparator = { kind: 'separator', name: '', description: '', default: undefined };
const grid: PrefBoolean = { kind: 'boolean', name: 'Grid', description: '', default: true };
const SCHEMA = { name: 'Prefs', children: { view: { name: 'View', children: { note, rule, grid } } } };

describe('a label and a separator', () => {
  it('are built-in kinds that hold no value', () => {
    expect([isBuiltinPref(note), isBuiltinPref(rule)]).toEqual([true, true]);
    expect([prefHoldsValue(note), prefHoldsValue(rule)]).toEqual([false, false]);
  });

  it('have no value in a store, and no path a store reads', () => {
    const cache = createRecordCache({ storage: createMemoryAdapter(new Map()), prefix: 'p.' });
    expect(createPrefsStore(SCHEMA, cache).values()).toEqual({ view: { grid: true } });
    expectTypeOf<PrefPath<typeof SCHEMA>>().toEqualTypeOf<'view.grid'>();
  });
});
