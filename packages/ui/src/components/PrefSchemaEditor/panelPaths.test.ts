import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { panelPathOf, treePathOfPanel } from './panelPaths';

const text = (name: string): PrefLeaf => ({ kind: 'string', name, description: '', default: '' });

const SCHEMA: PrefSection = {
  name: 'Node',
  members: {
    'data.name': text('Name'),
    'data.cap': { kind: 'object', type: 'cap', name: 'Cap', description: '', default: {}, children: { size: text('Size') } } as PrefLeaf,
    look: { name: 'Look', members: {
      'data.tint': text('Tint'),
      'data.stroke': { kind: 'object', name: 'Stroke', description: '', default: {}, children: {
        width: text('Width'),
        ends: { name: 'Ends', members: { cap: text('Cap') } },
      } } as PrefLeaf,
    } },
  },
};

describe('panelPathOf', () => {
  it('is a leaf\'s own key, a field\'s under its leaf\'s, and null for a section', () => {
    expect(panelPathOf(SCHEMA, 'data.name')).toBe('data.name');
    expect(panelPathOf(SCHEMA, 'look/data.tint')).toBe('data.tint');
    expect(panelPathOf(SCHEMA, 'look/data.stroke/width')).toBe('data.stroke.width');
    expect(panelPathOf(SCHEMA, 'look/data.stroke/ends/cap')).toBe('data.stroke.cap');
    expect(panelPathOf(SCHEMA, 'look')).toBeNull();
    expect(panelPathOf(SCHEMA, 'look/data.stroke/ends')).toBeNull();
    expect(panelPathOf(SCHEMA, 'look/gone')).toBeNull();
  });
});

describe('treePathOfPanel', () => {
  it('finds the leaf or field a panel path names, under whatever sections hold it', () => {
    expect(treePathOfPanel(SCHEMA, 'data.tint')).toBe('look/data.tint');
    expect(treePathOfPanel(SCHEMA, 'data.stroke')).toBe('look/data.stroke');
    expect(treePathOfPanel(SCHEMA, 'data.stroke.cap')).toBe('look/data.stroke/ends/cap');
    expect(treePathOfPanel(SCHEMA, 'data.gone')).toBeNull();
  });

  it('finds the leaf a field lies in when the tree shows that leaf as one row', () => {
    expect(treePathOfPanel(SCHEMA, 'data.cap.size')).toBe('data.cap');
  });
});
