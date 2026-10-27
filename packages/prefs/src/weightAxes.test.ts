import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import type { PrefGroup } from './groups';
import { createPrefsStore } from './store';
import { prefWeightAxes } from './weightAxes';

const MODE = 'look.mode';

const SCHEMA = {
  name: 'Test',
  children: {
    look: {
      name: 'Look',
      children: {
        mode: {
          kind: 'enum', name: 'Mode', description: '', default: 'dark',
          options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }],
        },
      },
    },
    gap: { kind: 'number', name: 'Gap', description: '', default: 4, min: 0, max: 100, splitBy: [MODE] },
  },
} satisfies PrefGroup;

describe('prefWeightAxes', () => {
  const axes = prefWeightAxes({ [MODE]: ['dark', 'light'], 'look.density': ['compact', 'roomy'] });

  it('gives each option of each selector one axis, named by the selector and the option', () => {
    expect(axes.count).toBe(4);
    expect(axes.names).toEqual(['look.mode.dark', 'look.mode.light', 'look.density.compact', 'look.density.roomy']);
  });

  it('turns weights to numbers and back, an option left out reading as 0 and one not listed dropped', () => {
    expect(axes.to({ [MODE]: { light: 1, dusk: 1 } })).toEqual([0, 1, 0, 0]);
    expect(axes.from([0.25, 0.75, 1, 0])).toEqual({ [MODE]: { dark: 0.25, light: 0.75 }, 'look.density': { compact: 1, roomy: 0 } });
  });

  it('reads a store at a point between two options, as an animation over the axes passes it', () => {
    const cache = createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.', initial: [['gap', { $by: MODE, $of: { dark: 4, light: 8 } }]] });
    const store = createPrefsStore(SCHEMA, cache);
    const mode = prefWeightAxes({ [MODE]: ['dark', 'light'] });
    expect(store.get('gap', { weights: mode.from([0.25, 0.75]) })).toBe(7);
  });
});
