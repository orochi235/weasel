import { describe, expect, it } from 'vitest';
import type { PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { aliasNodes, copyNodes } from './schemaCopy';
import { nodeAt } from './schemaTree';

const num = (name: string): PrefLeaf => ({ kind: 'number', name, description: '', default: 0 });
const alias = (of: string) => ({ kind: 'alias', name: '', description: '', default: undefined, of });

const NODE: PrefSection = {
  name: 'Rect',
  members: {
    layout: { name: 'Layout', members: {
      'pose.x': num('X'),
      note: { kind: 'label', name: 'Note', description: '', default: undefined } as PrefLeaf,
      size: { name: 'Size', members: { 'pose.w': num('W') } },
    } },
    look: { name: 'Look', members: { opacity: num('Opacity') } },
  },
};
const members = (root: PrefSection, path: string | null) => Object.keys((nodeAt(root, path) as PrefSection).members);

describe('a copy under a section root, where a leaf\'s key is the path its value lives at', () => {
  it('is an alias of a leaf that holds a value, set in another section', () => {
    const { root, paths } = copyNodes(NODE, ['layout/pose.x'], { parentPath: 'look', index: 0 });
    expect(paths).toEqual(['look/pose_xAlias']);
    expect(nodeAt(root, 'look/pose_xAlias')).toEqual(alias('pose.x'));
    expect(nodeAt(root, 'layout/pose.x')).toBe(nodeAt(NODE, 'layout/pose.x'));
  });

  it('is an alias beside its original too, and not a numbered path', () => {
    const { root, paths } = copyNodes(NODE, ['layout/pose.x'], { parentPath: 'layout', index: 1 });
    expect(paths).toEqual(['layout/pose_xAlias']);
    expect(members(root, 'layout')).toEqual(['pose.x', 'pose_xAlias', 'note', 'size']);
    expect(nodeAt(root, 'layout/pose_xAlias')).toEqual(alias('pose.x'));
  });

  it('keeps a leaf that holds no value as it is, under a key no other leaf has', () => {
    const { root, paths } = copyNodes(NODE, ['layout/note'], { parentPath: 'look', index: 0 });
    expect(paths).toEqual(['look/note2']);
    expect(nodeAt(root, 'look/note2')).toBe(nodeAt(NODE, 'layout/note'));
  });

  it('copies a section as one holding an alias of each value leaf inside it', () => {
    const { root, paths } = copyNodes(NODE, ['layout'], { parentPath: null, index: 2 });
    expect(paths).toEqual(['layout2']);
    expect(members(root, 'layout2')).toEqual(['pose_xAlias', 'note2', 'size']);
    expect(nodeAt(root, 'layout2')).toMatchObject({ name: 'Layout' });
    expect(nodeAt(root, 'layout2/pose_xAlias')).toEqual(alias('pose.x'));
    expect(nodeAt(root, 'layout2/size/pose_wAlias')).toEqual(alias('pose.w'));
    expect(nodeAt(root, 'layout')).toBe(NODE.members.layout);
  });

  it('numbers a second alias of one leaf, wherever the first sits', () => {
    const once = copyNodes(NODE, ['layout/pose.x'], { parentPath: 'look', index: 0 }).root;
    expect(copyNodes(once, ['layout/pose.x'], { parentPath: 'layout', index: 0 }).paths).toEqual(['layout/pose_xAlias2']);
    expect(aliasNodes(once, ['layout/pose.x'], { parentPath: 'layout', index: 0 }).paths).toEqual(['layout/pose_xAlias2']);
  });
});
