import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { PrefAction, PrefActions } from './action';
import { pref } from './build';
import { checkPrefCondition } from './conditionCheck';
import { prefsCss } from './css';
import { prefsDefaultsSource } from './defaultsSource';
import type { PrefGroup } from './groups';
import { prefHoldsValue } from './helpers';
import { prefDrawsSeveral, prefIsCompound } from './kinds';
import type { PrefPath } from './paths';
import { isBuiltinPref } from './schema';
import { createPrefsStore } from './store';

const arrange: PrefActions = { kind: 'actions', name: 'Arrange', description: '', default: undefined, group: 'arrange' };

const SCHEMA = {
  name: 'T',
  children: {
    arrange,
    view: pref.group('View', { gap: pref.number('Gap', 4, { unit: { scale: 1, suffix: 'px' } }), more: arrange }),
  },
} satisfies PrefGroup;

describe('an actions leaf', () => {
  it('is a built-in kind holding no value, drawn as several buttons', () => {
    expect(isBuiltinPref(arrange)).toBe(true);
    expect(prefHoldsValue(arrange)).toBe(false);
    expect([prefDrawsSeveral(arrange), prefIsCompound(arrange)]).toEqual([true, false]);
  });

  it('has no path', () => {
    expectTypeOf<PrefPath<typeof SCHEMA>>().toEqualTypeOf<'view.gap'>();
  });

  it('is neither read nor written by a store, nor by its defaults', () => {
    const cache = createRecordCache({ storage: createMemoryAdapter(new Map()), prefix: 'p.' });
    const store = createPrefsStore(SCHEMA, cache);
    expect(store.values()).toEqual({ view: { gap: 4 } });
    expect(prefsDefaultsSource(SCHEMA).values()).toEqual({ view: { gap: 4 } });
    expect(prefsCss(store)).not.toContain('arrange');
  });

  it('is no value for a condition to test', () => {
    const [problem] = checkPrefCondition({ path: 'arrange', is: true }, SCHEMA);
    expect(problem).toMatchObject({ code: 'no-value', problem: '"arrange" is an actions leaf, which holds no value' });
  });
});

describe('readout', () => {
  it('is kept by a builder and leaves the value stored and read', () => {
    const schema = pref.group('T', { size: pref.number('Size', 12, { readout: true }) });
    expect(schema.children.size.readout).toBe(true);
    const cache = createRecordCache({ storage: createMemoryAdapter(new Map()), prefix: 'p.' });
    const store = createPrefsStore(schema, cache);
    store.set('size', 14);
    expect(store.get('size')).toBe(14);
    expect(JSON.parse(JSON.stringify(schema)).children.size.readout).toBe(true);
  });

  it('is a field of a leaf holding a value, and of no other', () => {
    expectTypeOf<PrefActions>().not.toHaveProperty('readout');
    // @ts-expect-error an action has no value to read out
    const action: PrefAction = { kind: 'action', name: 'Go', description: '', default: undefined, readout: true };
    void action;
  });
});
