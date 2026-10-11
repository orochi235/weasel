import { describe, expect, it } from 'vitest';
import type { PrefAlias, PrefGroup, PrefLeaf, PrefSection } from '@weasel-js/prefs';
import { removeLayoutNodes } from './layoutEdit';
import { deadPointers } from './pointers';
import { moveNodes, removeNodes, renameKey, setAttribute, type SchemaRoot } from './schemaEdit';
import { assetOf, type Workspace } from './workspace';
import { CODE, pointer, SETTINGS, WORKSPACE } from './workspace.fixtures';
import { editAsset, movesOfMove, movesOfRename } from './workspaceEdit';

const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false });
const box = (name: string, children: Record<string, PrefLeaf | PrefSection>): PrefLeaf => ({ kind: 'object', name, description: '', default: {}, children });

const workspaceOf = (dialog: SchemaRoot, pointers: Record<string, PrefAlias>): Workspace => ({
  assets: [
    { id: 'settings', label: 'Settings', kind: 'schema', root: dialog },
    { id: 'code', label: 'Code', kind: 'layout', root: { name: 'Code', children: pointers }, over: 'settings' },
  ],
});
const lock = (workspace: Workspace, id: string): Workspace => ({ assets: workspace.assets.map((a) => (a.id === id ? { ...a, readOnly: true } : a)) });

const codeOf = (workspace: Workspace) => (assetOf(workspace, 'code')!.root as PrefGroup).children;
const ofAt = (workspace: Workspace, key: string) => (codeOf(workspace)[key] as PrefAlias).of;

describe('editAsset', () => {
  it('has a pointer follow its setting to a new key', () => {
    const next = editAsset(WORKSPACE, 'settings', renameKey(SETTINGS, 'view/grid', 'lines'), movesOfRename(SETTINGS, 'view/grid', 'lines'));
    expect(ofAt(next, 'grid')).toBe('view.lines');
    expect(ofAt(next, 'snap')).toBe('view.snap');
  });

  it('has a pointer follow its setting to another group', () => {
    const moved = moveNodes(SETTINGS, ['view/grid'], { parentPath: null, index: 0 });
    const next = editAsset(WORKSPACE, 'settings', moved.root, movesOfMove(SETTINGS, moved.from, moved.paths));
    expect(ofAt(next, 'grid')).toBe('grid');
    expect(ofAt(next, 'snap')).toBe('view.snap');
  });

  it('has a pointer follow a setting renamed inside a renamed group when both moves are passed', () => {
    const after = renameKey(renameKey(SETTINGS, 'view', 'vista'), 'vista/grid', 'lines');
    const next = editAsset(WORKSPACE, 'settings', after, [['view', 'vista'], ['view.grid', 'vista.lines']]);
    expect(ofAt(next, 'grid')).toBe('vista.lines');
    expect(ofAt(next, 'snap')).toBe('vista.snap');
  });

  it('has two settings of one name moved together keep their own pointers', () => {
    const dialog: PrefGroup = { name: 'Settings', children: {
      a: { name: 'A', children: { deep: { name: 'Deep', children: { enabled: flag('Enabled') } } } },
      c: { name: 'C', children: { enabled: flag('Enabled') } },
      target: { name: 'Target', children: {} },
    } };
    const start = workspaceOf(dialog, { first: pointer('a.deep.enabled'), second: pointer('c.enabled') });
    const moved = moveNodes(dialog, ['a/deep/enabled', 'c/enabled'], { parentPath: 'target', index: 0 });
    const next = editAsset(start, 'settings', moved.root, movesOfMove(dialog, moved.from, moved.paths));
    expect(ofAt(next, 'first')).toBe('target.enabled');
    expect(ofAt(next, 'second')).toBe('target.enabled2');
  });

  it('leaves a pointer alone when a heading over its setting is renamed', () => {
    const dialog: PrefSection = { name: 'Properties', members: { view: { name: 'View', members: { grid: flag('Show grid') } } } };
    const start = workspaceOf(dialog, { grid: pointer('grid') });
    const moves = movesOfRename(dialog, 'view', 'display');
    expect(moves).toEqual([]);
    const next = editAsset(start, 'settings', renameKey(dialog, 'view', 'display'), moves);
    expect(assetOf(next, 'code')).toBe(assetOf(start, 'code'));
  });

  it('leaves both pointers alone when a heading moves from one object to another', () => {
    const dialog: PrefGroup = { name: 'Settings', children: {
      a: box('A', { head: { name: 'Head', members: { x: flag('X') } } }),
      b: box('B', {}),
    } };
    const start = workspaceOf(dialog, { a: pointer('a'), b: pointer('b') });
    const moved = moveNodes(dialog, ['a/head'], { parentPath: 'b', index: 0 });
    expect(moved.paths).toEqual(['b/head']);
    const next = editAsset(start, 'settings', moved.root, movesOfMove(dialog, moved.from, moved.paths));
    expect(assetOf(next, 'code')).toBe(assetOf(start, 'code'));
  });

  it('drops the pointers to a removed setting and keeps the rest', () => {
    const next = editAsset(WORKSPACE, 'settings', removeNodes(SETTINGS, ['view/snap']));
    expect(Object.keys(codeOf(next))).toEqual(['grid']);
  });

  it('drops a pointer to an alias in the dialog that went with its setting', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, mirror: pointer('view.snap') } };
    const start = workspaceOf(dialog, { ...CODE.children as Record<string, PrefAlias>, mirror: pointer('mirror') });
    const after = removeNodes(dialog, ['view/snap']);
    expect(Object.keys(after.children)).toEqual(['view']);
    expect(Object.keys(codeOf(editAsset(start, 'settings', after)))).toEqual(['grid']);
  });

  it('keeps a pointer whose setting moved into an object, dead', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, box: box('Box', {}) } };
    const start = workspaceOf(dialog, CODE.children as Record<string, PrefAlias>);
    const moved = moveNodes(dialog, ['view/grid'], { parentPath: 'box', index: 0 });
    const next = editAsset(start, 'settings', moved.root, movesOfMove(dialog, moved.from, moved.paths));
    expect(ofAt(next, 'grid')).toBe('box.grid');
    expect(deadPointers(assetOf(next, 'code')!.root, moved.root)).toEqual(['grid']);
  });

  it('keeps a pointer to an alias in the dialog that such a move left dead', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, mirror: pointer('view.grid'), box: box('Box', {}) } };
    const start = workspaceOf(dialog, { mirror: pointer('mirror') });
    const moved = moveNodes(dialog, ['view/grid'], { parentPath: 'box', index: 0 });
    const next = editAsset(start, 'settings', moved.root, movesOfMove(dialog, moved.from, moved.paths));
    expect(ofAt(next, 'mirror')).toBe('mirror');
  });

  it('keeps a pointer that was already dead', () => {
    const start = workspaceOf(SETTINGS, { ...CODE.children as Record<string, PrefAlias>, lost: pointer('view.nowhere') });
    const next = editAsset(start, 'settings', removeNodes(SETTINGS, ['view/snap']));
    expect(Object.keys(codeOf(next))).toEqual(['grid', 'lost']);
  });

  it('keeps a pointer to a live setting whose path is the key of a dropped pointer', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, snap: flag('Snap all') } };
    const start = workspaceOf(dialog, { ...CODE.children as Record<string, PrefAlias>, all: pointer('snap') });
    const next = editAsset(start, 'settings', removeNodes(dialog, ['view/snap']));
    expect(Object.keys(codeOf(next))).toEqual(['grid', 'all']);
  });

  it('leaves a layout as it was when no setting moved or went', () => {
    const next = editAsset(WORKSPACE, 'settings', setAttribute(SETTINGS, 'view/grid', 'description', 'Lines every unit.'));
    expect(assetOf(next, 'code')).toBe(assetOf(WORKSPACE, 'code'));
  });

  it('refuses an edit to a read-only layout', () => {
    const locked = lock(WORKSPACE, 'code');
    expect(editAsset(locked, 'code', removeLayoutNodes(CODE, ['snap']))).toBe(locked);
  });

  it('refuses an edit to a read-only dialog', () => {
    const locked = lock(WORKSPACE, 'settings');
    expect(editAsset(locked, 'settings', renameKey(SETTINGS, 'view/grid', 'lines'), movesOfRename(SETTINGS, 'view/grid', 'lines'))).toBe(locked);
  });

  it('has a read-only layout follow its settings all the same', () => {
    const next = editAsset(lock(WORKSPACE, 'code'), 'settings', renameKey(SETTINGS, 'view/grid', 'lines'), movesOfRename(SETTINGS, 'view/grid', 'lines'));
    expect(ofAt(next, 'grid')).toBe('view.lines');
  });

  it('edits a layout without touching its dialog', () => {
    const next = editAsset(WORKSPACE, 'code', removeLayoutNodes(CODE, ['snap']));
    expect(Object.keys(codeOf(next))).toEqual(['grid']);
    expect(assetOf(next, 'settings')).toBe(assetOf(WORKSPACE, 'settings'));
  });
});
