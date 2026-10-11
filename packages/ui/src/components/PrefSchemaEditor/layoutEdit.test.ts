import { describe, expect, it } from 'vitest';
import type { PrefAlias, PrefGroup } from '@weasel-js/prefs';
import { moveLayoutNodes, removeLayoutNodes, renameLayoutKey } from './layoutEdit';
import { nodeAt } from './schemaEdit';
import { pointer } from './workspace.fixtures';

// `all` names the dialog's setting `grid`, which the layout's own key `grid` has nothing to do with.
const LAYOUT: PrefGroup = {
  name: 'Code',
  children: { grid: pointer('view.grid'), all: pointer('grid'), box: { name: 'Box', children: { inner: pointer('view.snap') } } },
};

const ofAt = (layout: PrefGroup, path: string) => (nodeAt(layout, path) as PrefAlias | undefined)?.of;

describe('layoutEdit', () => {
  it('renames a key and leaves every pointer naming what it named', () => {
    const next = renameLayoutKey(LAYOUT, 'grid', 'lines');
    expect(Object.keys(next.children)).toEqual(['lines', 'all', 'box']);
    expect(ofAt(next, 'lines')).toBe('view.grid');
    expect(ofAt(next, 'all')).toBe('grid');
  });

  it('moves a node and leaves every pointer naming what it named', () => {
    const moved = moveLayoutNodes(LAYOUT, ['grid'], { parentPath: 'box', index: 0 });
    expect(moved.from).toEqual(['grid']);
    expect(moved.paths).toEqual(['box/grid']);
    expect(Object.keys(moved.root.children)).toEqual(['all', 'box']);
    expect(ofAt(moved.root, 'box/grid')).toBe('view.grid');
    expect(ofAt(moved.root, 'all')).toBe('grid');
  });

  it('is the same layout when a move puts nothing anywhere new', () => {
    expect(moveLayoutNodes(LAYOUT, ['grid'], { parentPath: null, index: 0 }).root).toBe(LAYOUT);
  });

  it('removes a node and no pointer besides', () => {
    const next = removeLayoutNodes(LAYOUT, ['grid']);
    expect(Object.keys(next.children)).toEqual(['all', 'box']);
    expect(ofAt(next, 'all')).toBe('grid');
  });

  it('removes a node beneath another removed one with it', () => {
    expect(Object.keys(removeLayoutNodes(LAYOUT, ['box/inner', 'box']).children)).toEqual(['grid', 'all']);
  });
});
