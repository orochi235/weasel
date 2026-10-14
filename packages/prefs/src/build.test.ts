import { createMemoryAdapter, createRecordCache } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import { pref } from './build';
import type { PrefGroup } from './groups';
import type { PrefPath } from './paths';
import { createPrefsStore } from './store';

const SCHEMA = pref.group('Prefs', {
  look: pref.group('Look', {
    mode: pref.enum('Mode', 'dark', ['dark', 'light']),
    gap: pref.number('Gap', 4, { min: 0, max: 16, splitBy: ['look.mode'] }),
  }, { as: 'panel' }),
  grid: pref.boolean('Grid', true, { description: 'Draw the grid.' }),
  title: pref.string('Title', 'Untitled'),
  ink: pref.color('Ink', '#000000', { alpha: true }),
});

describe('pref builders', () => {
  it('return what the literal would hold', () => {
    const literal: PrefGroup = {
      name: 'Prefs',
      children: {
        look: {
          name: 'Look',
          as: 'panel',
          children: {
            mode: {
              kind: 'enum', name: 'Mode', description: '', default: 'dark',
              options: [{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }],
            },
            gap: { kind: 'number', name: 'Gap', description: '', default: 4, min: 0, max: 16, splitBy: ['look.mode'] },
          },
        },
        grid: { kind: 'boolean', name: 'Grid', description: 'Draw the grid.', default: true },
        title: { kind: 'string', name: 'Title', description: '', default: 'Untitled' },
        ink: { kind: 'color', name: 'Ink', description: '', default: '#000000', alpha: true },
      },
    };
    expect(SCHEMA).toEqual(literal);
  });

  it('keep an option written out in full, beside ones given as a value', () => {
    const leaf = pref.enum('Size', 's', ['s', { value: 'xl', label: 'Extra large', short: ['XL'] }]);
    expect(leaf.options).toEqual([{ value: 's', label: 'S' }, { value: 'xl', label: 'Extra large', short: ['XL'] }]);
  });

  it('build a section, whose members sit under `members`', () => {
    expect(pref.section('Pose', { 'pose.x': pref.number('X', 0) }, { as: 'panel' })).toEqual({
      name: 'Pose', as: 'panel', members: { 'pose.x': { kind: 'number', name: 'X', description: '', default: 0 } },
    });
  });

  it('type a schema as its literal would be: paths and values are read from it', () => {
    const path: PrefPath<typeof SCHEMA> = 'look.mode';
    // @ts-expect-error no leaf at this path
    const wrong: PrefPath<typeof SCHEMA> = 'look.nope';
    const store = createPrefsStore(SCHEMA, createRecordCache({ storage: createMemoryAdapter(), prefix: 'p.' }));
    const mode: 'dark' | 'light' = store.get('look.mode');
    const gap: number = store.get('look.gap');
    // @ts-expect-error an enum's value is one of its options
    store.set('look.mode', 'sepia');
    expect([path, wrong, mode, gap]).toEqual(['look.mode', 'look.nope', 'dark', 4]);
  });
});
