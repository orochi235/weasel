import { describe, expect, it } from 'vitest';
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { addNode, setAttribute } from './schemaEdit';
import { assetOf, type AssetSet } from './assetSet';
import { CODE, pointer, ASSET_SET } from '../testing/editAssetSet';
import { editAsset, moveInAsset, NO_MOVES, renameInAsset } from './assetSetEdit';

const flag: PrefLeaf = { kind: 'boolean', name: 'Wrap', description: '', default: false };
const codeOf = (assetSet: AssetSet) => assetOf(assetSet, 'code')!.root as PrefGroup;
const edit = (assetSet: AssetSet, next: PrefGroup) => editAsset(assetSet, 'code', next, NO_MOVES);

describe('editAsset on a layout', () => {
  it('refuses a setting: a layout points at settings, and a dialog holds them', () => {
    expect(edit(ASSET_SET, addNode(CODE, null, 'wrap', flag))).toBe(ASSET_SET);
    const grouped = edit(ASSET_SET, addNode(CODE, null, 'rows', { name: 'Rows', as: 'section', children: {} }));
    expect(edit(grouped, addNode(codeOf(grouped), 'rows', 'wrap', flag))).toBe(grouped);
  });

  it('takes a group, a pointer, an action, a label, and a separator', () => {
    const nodes: Record<string, PrefLeaf | PrefGroup> = {
      rows: { name: 'Rows', as: 'section', children: {} },
      again: pointer('view.grid'),
      save: { kind: 'action', name: 'Save', description: '', default: undefined, action: 'file.save' } as PrefLeaf,
      note: { kind: 'label', name: 'Note', description: '', default: undefined } as PrefLeaf,
      rule: { kind: 'separator', name: '', description: '', default: undefined } as PrefLeaf,
    };
    let assetSet = ASSET_SET;
    for (const [key, node] of Object.entries(nodes)) assetSet = edit(assetSet, addNode(codeOf(assetSet), null, key, node));
    expect(Object.keys(codeOf(assetSet).children)).toEqual(['grid', 'snap', ...Object.keys(nodes)]);
  });

  it('goes on editing a layout that already held a setting, and still takes no second one', () => {
    const held: AssetSet = { assets: ASSET_SET.assets.map((a) => (a.id === 'code' ? { ...a, root: addNode(CODE, null, 'wrap', flag) } : a)) };
    const renamed = edit(held, setAttribute(codeOf(held), 'wrap', 'name', 'Wrap lines'));
    expect(codeOf(renamed).children.wrap).toMatchObject({ name: 'Wrap lines' });
    const grouped = edit(held, addNode(codeOf(held), null, 'rows', { name: 'Rows', as: 'section', children: {} }));
    expect(Object.keys(codeOf(grouped).children)).toContain('rows');
    expect(edit(held, addNode(codeOf(held), null, 'more', flag))).toBe(held);
  });

  it('takes a setting in a dialog as before', () => {
    const next = editAsset(ASSET_SET, 'settings', addNode(ASSET_SET.assets[0]!.root, 'view', 'wrap', flag), NO_MOVES);
    expect(next).not.toBe(ASSET_SET);
  });
});

describe('a layout that already holds a setting, inside a section', () => {
  const root: PrefGroup = { name: 'Code', children: { grid: pointer('view.grid'), rows: { name: 'Rows', as: 'section', children: { wrap: flag } } } };
  const held: AssetSet = { assets: ASSET_SET.assets.map((a) => (a.id === 'code' ? { ...a, root } : a)) };
  const rowsOf = (assetSet: AssetSet, key = 'rows') => (codeOf(assetSet).children[key] as PrefGroup).children;

  it('takes a new key for the section over it', () => {
    const next = renameInAsset(held, 'code', 'rows', 'main');
    expect(Object.keys(codeOf(next).children)).toEqual(['grid', 'main']);
    expect(rowsOf(next, 'main').wrap).toBe(flag);
  });

  it('moves it to the root', () => {
    const next = moveInAsset(held, 'code', ['rows/wrap'], { parentPath: null, index: 0 }).assetSet;
    expect(Object.keys(codeOf(next).children)).toEqual(['wrap', 'grid', 'rows']);
  });

  it('still takes no second setting, beside it or anywhere else', () => {
    expect(edit(held, addNode(root, 'rows', 'more', { ...flag }))).toBe(held);
    expect(edit(held, addNode(root, null, 'more', { ...flag }))).toBe(held);
  });

  it('still refuses a pointer turned into a setting where it sits', () => {
    expect(edit(held, { ...root, children: { ...root.children, grid: flag } })).toBe(held);
    expect(edit(held, { ...root, children: { ...root.children, grid: { ...flag, name: 'Grid' } } })).toBe(held);
  });

  it('still edits the setting where it sits', () => {
    const next = edit(held, setAttribute(root, 'rows/wrap', 'name', 'Wrap lines'));
    expect(rowsOf(next).wrap).toMatchObject({ name: 'Wrap lines' });
  });
});
