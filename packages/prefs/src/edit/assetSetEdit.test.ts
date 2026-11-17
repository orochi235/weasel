import { describe, expect, it } from 'vitest';
import type { PrefAlias, PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { deadPointers, pointerTarget } from './pointers';
import { moveNodes, renameKey, setAttribute, type SchemaRoot } from './schemaEdit';
import { assetOf, type AssetSet } from './assetSet';
import { CODE, pointer, SETTINGS, ASSET_SET } from '../testing/editAssetSet';
import { editAsset, moveInAsset, NO_MOVES, removeInAsset, renameInAsset } from './assetSetEdit';

const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false });
const box = (name: string, children: Record<string, PrefLeaf | PrefSection>): PrefLeaf => ({ kind: 'object', name, description: '', default: {}, children });
const CODE_POINTERS = CODE.children as Record<string, PrefAlias>;

const assetSetOf = (dialog: SchemaRoot, layout: PrefGroup['children']): AssetSet => ({
  assets: [
    { id: 'settings', label: 'Settings', kind: 'schema', root: dialog },
    { id: 'code', label: 'Code', kind: 'layout', root: { name: 'Code', children: layout }, over: 'settings' },
  ],
});
const lock = (assetSet: AssetSet, id: string): AssetSet => ({ assets: assetSet.assets.map((a) => (a.id === id ? { ...a, readOnly: true } : a)) });

const codeOf = (assetSet: AssetSet) => (assetOf(assetSet, 'code')!.root as PrefGroup).children;
const ofAt = (assetSet: AssetSet, key: string) => (codeOf(assetSet)[key] as PrefAlias).of;

// `all` names the dialog's setting `grid`, which the layout's own key `grid` has nothing to do with.
const CROSSED = assetSetOf(
  { ...SETTINGS, children: { ...SETTINGS.children, grid: flag('Grid everywhere') } },
  { grid: pointer('view.grid'), all: pointer('grid'), box: { name: 'Box', children: {} } },
);

describe('renameInAsset', () => {
  it('has a pointer follow its setting to a new key', () => {
    const next = renameInAsset(ASSET_SET, 'settings', 'view/grid', 'lines');
    expect(Object.keys(((assetOf(next, 'settings')!.root as PrefGroup).children.view as PrefGroup).children)).toEqual(['lines', 'snap']);
    expect(ofAt(next, 'grid')).toBe('view.lines');
    expect(ofAt(next, 'snap')).toBe('view.snap');
  });

  it('leaves a pointer alone when a heading over its setting is renamed', () => {
    const dialog: PrefSection = { name: 'Properties', members: { view: { name: 'View', members: { 'view.grid': flag('Show grid') } } } };
    const next = renameInAsset(assetSetOf(dialog, { grid: pointer('view.grid') }), 'settings', 'view', 'display');
    const after = assetOf(next, 'settings')!.root as PrefSection;
    expect(Object.keys(after.members)).toEqual(['display']);
    expect(ofAt(next, 'grid')).toBe('view.grid');
    expect(pointerTarget(after, codeOf(next).grid as PrefAlias)).toBeDefined();
  });

  it('renames a key in a layout and leaves every pointer naming what it named', () => {
    const next = renameInAsset(CROSSED, 'code', 'grid', 'lines');
    expect(Object.keys(codeOf(next))).toEqual(['lines', 'all', 'box']);
    expect(ofAt(next, 'lines')).toBe('view.grid');
    expect(ofAt(next, 'all')).toBe('grid');
    expect(assetOf(next, 'settings')).toBe(assetOf(CROSSED, 'settings'));
  });

  it('leaves the asset set as it was for a read-only asset, or one it does not hold', () => {
    for (const id of ['settings', 'code']) {
      const locked = lock(ASSET_SET, id);
      expect(renameInAsset(locked, id, id === 'code' ? 'grid' : 'view/grid', 'lines')).toBe(locked);
    }
    expect(renameInAsset(ASSET_SET, 'nowhere', 'grid', 'lines')).toBe(ASSET_SET);
  });

  it('has a read-only layout follow its settings all the same', () => {
    expect(ofAt(renameInAsset(lock(ASSET_SET, 'code'), 'settings', 'view/grid', 'lines'), 'grid')).toBe('view.lines');
  });
});

describe('moveInAsset', () => {
  it('has a pointer follow its setting to another group', () => {
    const moved = moveInAsset(ASSET_SET, 'settings', ['view/grid'], { parentPath: null, index: 0 });
    expect(moved.from).toEqual(['view/grid']);
    expect(moved.paths).toEqual(['grid']);
    expect(ofAt(moved.assetSet, 'grid')).toBe('grid');
    expect(ofAt(moved.assetSet, 'snap')).toBe('view.snap');
  });

  it('has two settings of one name moved together keep their own pointers', () => {
    const dialog: PrefGroup = { name: 'Settings', children: {
      a: { name: 'A', children: { deep: { name: 'Deep', children: { enabled: flag('Enabled') } } } },
      c: { name: 'C', children: { enabled: flag('Enabled') } },
      target: { name: 'Target', children: {} },
    } };
    const start = assetSetOf(dialog, { first: pointer('a.deep.enabled'), second: pointer('c.enabled') });
    const next = moveInAsset(start, 'settings', ['a/deep/enabled', 'c/enabled'], { parentPath: 'target', index: 0 }).assetSet;
    expect(ofAt(next, 'first')).toBe('target.enabled');
    expect(ofAt(next, 'second')).toBe('target.enabled2');
  });

  it('leaves both pointers alone when a heading moves from one object to another', () => {
    const dialog: PrefGroup = { name: 'Settings', children: {
      a: box('A', { head: { name: 'Head', members: { x: flag('X') } } }),
      b: box('B', {}),
    } };
    const start = assetSetOf(dialog, { a: pointer('a'), b: pointer('b') });
    const moved = moveInAsset(start, 'settings', ['a/head'], { parentPath: 'b', index: 0 });
    expect(moved.paths).toEqual(['b/head']);
    expect(assetOf(moved.assetSet, 'code')).toBe(assetOf(start, 'code'));
  });

  it('keeps a pointer to an alias in the dialog that a move into an object left dead', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, mirror: pointer('view.grid'), box: box('Box', {}) } };
    const next = moveInAsset(assetSetOf(dialog, { mirror: pointer('mirror') }), 'settings', ['view/grid'], { parentPath: 'box', index: 0 }).assetSet;
    expect(ofAt(next, 'mirror')).toBe('mirror');
  });

  it('moves a node in a layout and leaves every pointer naming what it named', () => {
    const moved = moveInAsset(CROSSED, 'code', ['grid'], { parentPath: 'box', index: 0 });
    expect(moved.from).toEqual(['grid']);
    expect(moved.paths).toEqual(['box/grid']);
    expect(Object.keys(codeOf(moved.assetSet))).toEqual(['all', 'box']);
    expect(((codeOf(moved.assetSet).box as PrefGroup).children.grid as PrefAlias).of).toBe('view.grid');
    expect(ofAt(moved.assetSet, 'all')).toBe('grid');
    expect(assetOf(moved.assetSet, 'settings')).toBe(assetOf(CROSSED, 'settings'));
  });

  it('leaves the asset set as it was for a read-only asset, or one it does not hold, as a move that did nothing', () => {
    const paths = ['view/grid', 'view', 'view/snap'];
    const target = { parentPath: null, index: 0 };
    const idle = moveNodes(SETTINGS, ['view'], target);
    expect(idle.root).toBe(SETTINGS);
    const locked = lock(ASSET_SET, 'settings');
    expect(moveInAsset(locked, 'settings', paths, target)).toEqual({ assetSet: locked, from: idle.from, paths: idle.paths });
    expect(moveInAsset(locked, 'settings', paths, target).assetSet).toBe(locked);
    const lockedLayout = lock(ASSET_SET, 'code');
    expect(moveInAsset(lockedLayout, 'code', ['snap'], target).assetSet).toBe(lockedLayout);
    expect(moveInAsset(ASSET_SET, 'nowhere', ['snap'], target)).toEqual({ assetSet: ASSET_SET, from: ['snap'], paths: ['snap'] });
  });
});

describe('removeInAsset', () => {
  it('drops the pointers to a removed setting and keeps the rest', () => {
    const next = removeInAsset(ASSET_SET, 'settings', ['view/snap']);
    expect(Object.keys(codeOf(next))).toEqual(['grid']);
  });

  it('drops a pointer to an alias in the dialog that went with its setting', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, mirror: pointer('view.snap') } };
    const next = removeInAsset(assetSetOf(dialog, { ...CODE_POINTERS, mirror: pointer('mirror') }), 'settings', ['view/snap']);
    expect(Object.keys((assetOf(next, 'settings')!.root as PrefGroup).children)).toEqual(['view']);
    expect(Object.keys(codeOf(next))).toEqual(['grid']);
  });

  it('keeps a pointer that was already dead', () => {
    const next = removeInAsset(assetSetOf(SETTINGS, { ...CODE_POINTERS, lost: pointer('view.nowhere') }), 'settings', ['view/snap']);
    expect(Object.keys(codeOf(next))).toEqual(['grid', 'lost']);
  });

  it('keeps a pointer to a live setting whose path is the key of a dropped pointer', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, snap: flag('Snap all') } };
    const next = removeInAsset(assetSetOf(dialog, { ...CODE_POINTERS, all: pointer('snap') }), 'settings', ['view/snap']);
    expect(Object.keys(codeOf(next))).toEqual(['grid', 'all']);
  });

  it('removes a node from a layout, no pointer besides, and nothing from its dialog', () => {
    const next = removeInAsset(CROSSED, 'code', ['grid']);
    expect(Object.keys(codeOf(next))).toEqual(['all', 'box']);
    expect(ofAt(next, 'all')).toBe('grid');
    expect(assetOf(next, 'settings')).toBe(assetOf(CROSSED, 'settings'));
  });

  it('leaves the asset set as it was for a read-only asset, or one it does not hold', () => {
    const lockedDialog = lock(ASSET_SET, 'settings');
    expect(removeInAsset(lockedDialog, 'settings', ['view/snap'])).toBe(lockedDialog);
    const lockedLayout = lock(ASSET_SET, 'code');
    expect(removeInAsset(lockedLayout, 'code', ['snap'])).toBe(lockedLayout);
    expect(removeInAsset(ASSET_SET, 'nowhere', ['snap'])).toBe(ASSET_SET);
  });
});

describe('editAsset', () => {
  it('has a pointer follow a setting renamed inside a renamed group when both moves are passed', () => {
    const after = renameKey(renameKey(SETTINGS, 'view', 'vista'), 'vista/grid', 'lines');
    const next = editAsset(ASSET_SET, 'settings', after, [['view', 'vista'], ['view.grid', 'vista.lines']]);
    expect(ofAt(next, 'grid')).toBe('vista.lines');
    expect(ofAt(next, 'snap')).toBe('vista.snap');
  });

  it('keeps a pointer whose setting moved into an object, dead', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, box: box('Box', {}) } };
    const moved = moveNodes(dialog, ['view/grid'], { parentPath: 'box', index: 0 });
    const next = editAsset(assetSetOf(dialog, CODE_POINTERS), 'settings', moved.root, [['view.grid', 'box.grid']]);
    expect(ofAt(next, 'grid')).toBe('box.grid');
    expect(deadPointers(assetOf(next, 'code')!.root, moved.root)).toEqual(['grid']);
  });

  it('leaves a layout as it was when no setting moved or went', () => {
    const next = editAsset(ASSET_SET, 'settings', setAttribute(SETTINGS, 'view/grid', 'description', 'Lines every unit.'), NO_MOVES);
    expect(assetOf(next, 'settings')!.root).not.toBe(SETTINGS);
    expect(assetOf(next, 'code')).toBe(assetOf(ASSET_SET, 'code'));
  });

  it('refuses an edit to a read-only asset', () => {
    const locked = lock(ASSET_SET, 'settings');
    expect(editAsset(locked, 'settings', setAttribute(SETTINGS, 'view/grid', 'name', 'Lines'), NO_MOVES)).toBe(locked);
  });
});

describe('a pointer to a field inside an object leaf', () => {
  const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, box: box('Box', {}) } };
  const start = assetSetOf(dialog, { ...CODE_POINTERS, lost: pointer('view.gone') });
  const inside = moveInAsset(start, 'settings', ['view/grid'], { parentPath: 'box', index: 0 }).assetSet;

  it('stays, dead, while the field stands', () => {
    expect(ofAt(inside, 'grid')).toBe('box.grid');
    expect(deadPointers(assetOf(inside, 'code')!.root, assetOf(inside, 'settings')!.root)).toEqual(['grid', 'lost']);
  });

  it('goes with the field when the field is removed', () => {
    expect(Object.keys(codeOf(removeInAsset(inside, 'settings', ['box/grid'])))).toEqual(['snap', 'lost']);
  });

  it('goes with the object leaf when that is removed', () => {
    expect(Object.keys(codeOf(removeInAsset(inside, 'settings', ['box'])))).toEqual(['snap', 'lost']);
  });

  it('is live again once the field moves back out', () => {
    const out = moveInAsset(inside, 'settings', ['box/grid'], { parentPath: 'view', index: 0 }).assetSet;
    expect(ofAt(out, 'grid')).toBe('view.grid');
    expect(deadPointers(assetOf(out, 'code')!.root, assetOf(out, 'settings')!.root)).toEqual(['lost']);
  });

  it('is kept when it names nothing at all, whatever else is removed', () => {
    expect(Object.keys(codeOf(removeInAsset(start, 'settings', ['view/snap'])))).toEqual(['grid', 'lost']);
    expect(Object.keys(codeOf(removeInAsset(inside, 'settings', ['box'])))).toContain('lost');
  });
});
