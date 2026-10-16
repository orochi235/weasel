import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefSection } from './groups';
import { prefLeafTags, prefLeavesTagged } from './tags';

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      tags: ['workspace'],
      children: {
        grid: { kind: 'boolean', name: 'Show grid', description: '', default: true, tags: ['guides'] },
        snap: {
          name: 'Snapping',
          tags: ['guides'],
          children: { toGrid: { kind: 'boolean', name: 'To grid', description: '', default: true } },
        },
      },
    },
    author: { kind: 'string', name: 'Author', description: '', default: '' },
  },
};

describe('prefLeavesTagged', () => {
  it('gathers the leaves carrying a tag, by path, one under a group carrying it included', () => {
    expect([...prefLeavesTagged(SCHEMA, 'guides').keys()]).toEqual(['canvas.grid', 'canvas.snap.toGrid']);
    expect([...prefLeavesTagged(SCHEMA, 'workspace').keys()]).toEqual(['canvas.grid', 'canvas.snap.toGrid']);
    expect(prefLeavesTagged(SCHEMA, 'guide').size).toBe(0);
  });

  it('reads a section by its leaves’ own keys', () => {
    const section: PrefSection = {
      name: 'Node',
      members: {
        geometry: { name: 'Geometry', tags: ['layout'], members: { 'pose.x': { kind: 'number', name: 'X', description: '', default: 0 } } },
        'data.fill': { kind: 'color', name: 'Fill', description: '', default: '#000' },
      },
    };
    expect([...prefLeavesTagged(section, 'layout').keys()]).toEqual(['pose.x']);
  });
});

describe('prefLeafTags', () => {
  it('is the tags of every group above a leaf, outermost first, then its own', () => {
    expect(prefLeafTags(SCHEMA, 'canvas.snap.toGrid')).toEqual(['workspace', 'guides']);
    expect(prefLeafTags(SCHEMA, 'canvas.grid')).toEqual(['workspace', 'guides']);
    expect(prefLeafTags(SCHEMA, 'author')).toEqual([]);
  });
});
