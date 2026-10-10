import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefSection } from '@weasel-js/prefs';
import { setDefaults } from './defaults';
import { nodeAt } from './schemaEdit';

const GROUP: PrefGroup = {
  name: 'Root',
  children: {
    view: { name: 'View', children: {
      zoom: { kind: 'number', name: 'Zoom', description: '', default: 1 },
      pad: { kind: 'object', name: 'Pad', description: '', default: { x: 0, y: 0 }, children: {} },
    } },
  },
};

const NODE: PrefSection = {
  name: 'Rect',
  members: {
    layout: { name: 'Layout', members: {
      'pose.x': { kind: 'number', name: 'X', description: '', default: 0 },
    } },
    'data.text': { kind: 'string', name: 'Text', description: '', default: 'hello' },
  },
};

describe('setDefaults', () => {
  it('writes a value as the default of the leaf at its path, through the groups above it', () => {
    const next = setDefaults(GROUP, [[['view', 'zoom'], 2]]);
    expect(nodeAt(next, 'view/zoom')).toMatchObject({ default: 2, name: 'Zoom' });
    expect(nodeAt(GROUP, 'view/zoom')).toMatchObject({ default: 1 });
  });

  it('writes into a default when the path runs past the leaf', () => {
    const next = setDefaults(GROUP, [[['view', 'pad', 'y'], 4]]);
    expect(nodeAt(next, 'view/pad')).toMatchObject({ default: { x: 0, y: 4 } });
  });

  it('finds a leaf keyed by a dotted path under sections, whose keys are no part of it', () => {
    const next = setDefaults(NODE, [[['pose', 'x'], 12], [['data', 'text'], 'typed']]);
    expect(nodeAt(next, 'layout/pose.x')).toMatchObject({ default: 12 });
    expect(nodeAt(next, 'data.text')).toMatchObject({ default: 'typed' });
  });

  it('drops an edit no leaf describes', () => {
    expect(setDefaults(GROUP, [[['view', 'nope'], 1]])).toBe(GROUP);
  });
});
