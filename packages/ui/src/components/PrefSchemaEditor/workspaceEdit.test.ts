import { describe, expect, it } from 'vitest';
import type { PrefAlias, PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { deadPointers, pointerTarget } from './pointers';
import { moveNodes, renameKey, setAttribute, type SchemaRoot } from './schemaEdit';
import { assetOf, type Workspace } from './workspace';
import { CODE, pointer, SETTINGS, WORKSPACE } from './workspace.fixtures';
import { editAsset, moveInAsset, NO_MOVES, removeInAsset, renameInAsset } from './workspaceEdit';

const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false });
const box = (name: string, children: Record<string, PrefLeaf | PrefSection>): PrefLeaf => ({ kind: 'object', name, description: '', default: {}, children });
const CODE_POINTERS = CODE.children as Record<string, PrefAlias>;

const workspaceOf = (dialog: SchemaRoot, layout: PrefGroup['children']): Workspace => ({
  assets: [
    { id: 'settings', label: 'Settings', kind: 'schema', root: dialog },
    { id: 'code', label: 'Code', kind: 'layout', root: { name: 'Code', children: layout }, over: 'settings' },
  ],
});
const lock = (workspace: Workspace, id: string): Workspace => ({ assets: workspace.assets.map((a) => (a.id === id ? { ...a, readOnly: true } : a)) });

const codeOf = (workspace: Workspace) => (assetOf(workspace, 'code')!.root as PrefGroup).children;
const ofAt = (workspace: Workspace, key: string) => (codeOf(workspace)[key] as PrefAlias).of;

// `all` names the dialog's setting `grid`, which the layout's own key `grid` has nothing to do with.
const CROSSED = workspaceOf(
  { ...SETTINGS, children: { ...SETTINGS.children, grid: flag('Grid everywhere') } },
  { grid: pointer('view.grid'), all: pointer('grid'), box: { name: 'Box', children: {} } },
);

describe('renameInAsset', () => {
  it('has a pointer follow its setting to a new key', () => {
    const next = renameInAsset(WORKSPACE, 'settings', 'view/grid', 'lines');
    expect(Object.keys(((assetOf(next, 'settings')!.root as PrefGroup).children.view as PrefGroup).children)).toEqual(['lines', 'snap']);
    expect(ofAt(next, 'grid')).toBe('view.lines');
    expect(ofAt(next, 'snap')).toBe('view.snap');
  });

  it('leaves a pointer alone when a heading over its setting is renamed', () => {
    const dialog: PrefSection = { name: 'Properties', members: { view: { name: 'View', members: { 'view.grid': flag('Show grid') } } } };
    const next = renameInAsset(workspaceOf(dialog, { grid: pointer('view.grid') }), 'settings', 'view', 'display');
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

  it('leaves the workspace as it was for a read-only asset, or one it does not hold', () => {
    for (const id of ['settings', 'code']) {
      const locked = lock(WORKSPACE, id);
      expect(renameInAsset(locked, id, id === 'code' ? 'grid' : 'view/grid', 'lines')).toBe(locked);
    }
    expect(renameInAsset(WORKSPACE, 'nowhere', 'grid', 'lines')).toBe(WORKSPACE);
  });

  it('has a read-only layout follow its settings all the same', () => {
    expect(ofAt(renameInAsset(lock(WORKSPACE, 'code'), 'settings', 'view/grid', 'lines'), 'grid')).toBe('view.lines');
  });
});

describe('moveInAsset', () => {
  it('has a pointer follow its setting to another group', () => {
    const moved = moveInAsset(WORKSPACE, 'settings', ['view/grid'], { parentPath: null, index: 0 });
    expect(moved.from).toEqual(['view/grid']);
    expect(moved.paths).toEqual(['grid']);
    expect(ofAt(moved.workspace, 'grid')).toBe('grid');
    expect(ofAt(moved.workspace, 'snap')).toBe('view.snap');
  });

  it('has two settings of one name moved together keep their own pointers', () => {
    const dialog: PrefGroup = { name: 'Settings', children: {
      a: { name: 'A', children: { deep: { name: 'Deep', children: { enabled: flag('Enabled') } } } },
      c: { name: 'C', children: { enabled: flag('Enabled') } },
      target: { name: 'Target', children: {} },
    } };
    const start = workspaceOf(dialog, { first: pointer('a.deep.enabled'), second: pointer('c.enabled') });
    const next = moveInAsset(start, 'settings', ['a/deep/enabled', 'c/enabled'], { parentPath: 'target', index: 0 }).workspace;
    expect(ofAt(next, 'first')).toBe('target.enabled');
    expect(ofAt(next, 'second')).toBe('target.enabled2');
  });

  it('leaves both pointers alone when a heading moves from one object to another', () => {
    const dialog: PrefGroup = { name: 'Settings', children: {
      a: box('A', { head: { name: 'Head', members: { x: flag('X') } } }),
      b: box('B', {}),
    } };
    const start = workspaceOf(dialog, { a: pointer('a'), b: pointer('b') });
    const moved = moveInAsset(start, 'settings', ['a/head'], { parentPath: 'b', index: 0 });
    expect(moved.paths).toEqual(['b/head']);
    expect(assetOf(moved.workspace, 'code')).toBe(assetOf(start, 'code'));
  });

  it('keeps a pointer to an alias in the dialog that a move into an object left dead', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, mirror: pointer('view.grid'), box: box('Box', {}) } };
    const next = moveInAsset(workspaceOf(dialog, { mirror: pointer('mirror') }), 'settings', ['view/grid'], { parentPath: 'box', index: 0 }).workspace;
    expect(ofAt(next, 'mirror')).toBe('mirror');
  });

  it('moves a node in a layout and leaves every pointer naming what it named', () => {
    const moved = moveInAsset(CROSSED, 'code', ['grid'], { parentPath: 'box', index: 0 });
    expect(moved.from).toEqual(['grid']);
    expect(moved.paths).toEqual(['box/grid']);
    expect(Object.keys(codeOf(moved.workspace))).toEqual(['all', 'box']);
    expect(((codeOf(moved.workspace).box as PrefGroup).children.grid as PrefAlias).of).toBe('view.grid');
    expect(ofAt(moved.workspace, 'all')).toBe('grid');
    expect(assetOf(moved.workspace, 'settings')).toBe(assetOf(CROSSED, 'settings'));
  });

  it('leaves the workspace as it was for a read-only asset, or one it does not hold, as a move that did nothing', () => {
    const paths = ['view/grid', 'view', 'view/snap'];
    const target = { parentPath: null, index: 0 };
    const idle = moveNodes(SETTINGS, ['view'], target);
    expect(idle.root).toBe(SETTINGS);
    const locked = lock(WORKSPACE, 'settings');
    expect(moveInAsset(locked, 'settings', paths, target)).toEqual({ workspace: locked, from: idle.from, paths: idle.paths });
    expect(moveInAsset(locked, 'settings', paths, target).workspace).toBe(locked);
    const lockedLayout = lock(WORKSPACE, 'code');
    expect(moveInAsset(lockedLayout, 'code', ['snap'], target).workspace).toBe(lockedLayout);
    expect(moveInAsset(WORKSPACE, 'nowhere', ['snap'], target)).toEqual({ workspace: WORKSPACE, from: ['snap'], paths: ['snap'] });
  });
});

describe('removeInAsset', () => {
  it('drops the pointers to a removed setting and keeps the rest', () => {
    const next = removeInAsset(WORKSPACE, 'settings', ['view/snap']);
    expect(Object.keys(codeOf(next))).toEqual(['grid']);
  });

  it('drops a pointer to an alias in the dialog that went with its setting', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, mirror: pointer('view.snap') } };
    const next = removeInAsset(workspaceOf(dialog, { ...CODE_POINTERS, mirror: pointer('mirror') }), 'settings', ['view/snap']);
    expect(Object.keys((assetOf(next, 'settings')!.root as PrefGroup).children)).toEqual(['view']);
    expect(Object.keys(codeOf(next))).toEqual(['grid']);
  });

  it('keeps a pointer that was already dead', () => {
    const next = removeInAsset(workspaceOf(SETTINGS, { ...CODE_POINTERS, lost: pointer('view.nowhere') }), 'settings', ['view/snap']);
    expect(Object.keys(codeOf(next))).toEqual(['grid', 'lost']);
  });

  it('keeps a pointer to a live setting whose path is the key of a dropped pointer', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, snap: flag('Snap all') } };
    const next = removeInAsset(workspaceOf(dialog, { ...CODE_POINTERS, all: pointer('snap') }), 'settings', ['view/snap']);
    expect(Object.keys(codeOf(next))).toEqual(['grid', 'all']);
  });

  it('removes a node from a layout, no pointer besides, and nothing from its dialog', () => {
    const next = removeInAsset(CROSSED, 'code', ['grid']);
    expect(Object.keys(codeOf(next))).toEqual(['all', 'box']);
    expect(ofAt(next, 'all')).toBe('grid');
    expect(assetOf(next, 'settings')).toBe(assetOf(CROSSED, 'settings'));
  });

  it('leaves the workspace as it was for a read-only asset, or one it does not hold', () => {
    const lockedDialog = lock(WORKSPACE, 'settings');
    expect(removeInAsset(lockedDialog, 'settings', ['view/snap'])).toBe(lockedDialog);
    const lockedLayout = lock(WORKSPACE, 'code');
    expect(removeInAsset(lockedLayout, 'code', ['snap'])).toBe(lockedLayout);
    expect(removeInAsset(WORKSPACE, 'nowhere', ['snap'])).toBe(WORKSPACE);
  });
});

describe('editAsset', () => {
  it('has a pointer follow a setting renamed inside a renamed group when both moves are passed', () => {
    const after = renameKey(renameKey(SETTINGS, 'view', 'vista'), 'vista/grid', 'lines');
    const next = editAsset(WORKSPACE, 'settings', after, [['view', 'vista'], ['view.grid', 'vista.lines']]);
    expect(ofAt(next, 'grid')).toBe('vista.lines');
    expect(ofAt(next, 'snap')).toBe('vista.snap');
  });

  it('keeps a pointer whose setting moved into an object, dead', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, box: box('Box', {}) } };
    const moved = moveNodes(dialog, ['view/grid'], { parentPath: 'box', index: 0 });
    const next = editAsset(workspaceOf(dialog, CODE_POINTERS), 'settings', moved.root, [['view.grid', 'box.grid']]);
    expect(ofAt(next, 'grid')).toBe('box.grid');
    expect(deadPointers(assetOf(next, 'code')!.root, moved.root)).toEqual(['grid']);
  });

  it('leaves a layout as it was when no setting moved or went', () => {
    const next = editAsset(WORKSPACE, 'settings', setAttribute(SETTINGS, 'view/grid', 'description', 'Lines every unit.'), NO_MOVES);
    expect(assetOf(next, 'settings')!.root).not.toBe(SETTINGS);
    expect(assetOf(next, 'code')).toBe(assetOf(WORKSPACE, 'code'));
  });

  it('refuses an edit to a read-only asset', () => {
    const locked = lock(WORKSPACE, 'settings');
    expect(editAsset(locked, 'settings', setAttribute(SETTINGS, 'view/grid', 'name', 'Lines'), NO_MOVES)).toBe(locked);
  });
});
