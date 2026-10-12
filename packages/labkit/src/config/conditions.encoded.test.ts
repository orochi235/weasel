import type { PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { f } from './builder';
import type { ResolvedConfig } from './types';
import { isEntryShown, isLeafEnabled, isLeafVisible } from './visible';

const italic = {
  read: (stored: unknown) => stored === 'italic',
  write: (on: boolean) => (on ? 'italic' : 'normal'),
};
const resolved: ResolvedConfig = {
  group: {
    name: '',
    children: {
      slant: {
        kind: 'boolean',
        name: 'Italic',
        description: '',
        default: false,
        encoding: italic,
      } as PrefLeaf,
      angle: {
        kind: 'number',
        name: 'Angle',
        description: '',
        default: 12,
        showIf: { path: 'slant', is: true },
      } as PrefLeaf,
      weight: {
        kind: 'number',
        name: 'Weight',
        description: '',
        default: 400,
        enableIf: { not: { path: 'slant' } },
      } as PrefLeaf,
    },
  },
  sections: [],
  showIf: new Map(),
  renderers: {},
  dialogs: {},
};

describe('a condition over a leaf stored through an encoding', () => {
  it('compares what the control shows, and not what it stores', () => {
    expect(isLeafVisible(resolved, 'angle', { slant: 'italic' })).toBe(true);
    expect(isLeafVisible(resolved, 'angle', { slant: 'normal' })).toBe(false);
    expect(isLeafEnabled(resolved, 'weight', { slant: 'italic' })).toBe(false);
    expect(isLeafEnabled(resolved, 'weight', { slant: 'normal' })).toBe(true);
  });

  it('does the same for a node of a schema not yet walked by path', () => {
    const angle = f.number(12).showIf({ path: 'slant', is: true });
    expect(isEntryShown(angle, { slant: 'italic' }, resolved.group)).toBe(true);
    expect(isEntryShown(angle, { slant: 'normal' }, resolved.group)).toBe(false);
  });
});
