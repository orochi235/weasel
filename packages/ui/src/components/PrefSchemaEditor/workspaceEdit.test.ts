import { describe, expect, it } from 'vitest';
import type { PrefAlias, PrefGroup } from '@weasel-js/prefs';
import { moveNodes, removeNodes, renameKey, setAttribute } from './schemaEdit';
import { assetOf, type Workspace } from './workspace';
import { CODE, pointer, SETTINGS, WORKSPACE } from './workspace.fixtures';
import { editAsset } from './workspaceEdit';

const codeOf = (workspace: Workspace) => (assetOf(workspace, 'code')!.root as PrefGroup).children;
const ofAt = (workspace: Workspace, key: string) => (codeOf(workspace)[key] as PrefAlias).of;

describe('editAsset', () => {
  it('has a pointer follow its setting to a new key', () => {
    const next = editAsset(WORKSPACE, 'settings', renameKey(SETTINGS, 'view/grid', 'lines'));
    expect(ofAt(next, 'grid')).toBe('view.lines');
    expect(ofAt(next, 'snap')).toBe('view.snap');
  });

  it('has a pointer follow its setting to another group', () => {
    const moved = moveNodes(SETTINGS, ['view/grid'], { parentPath: null, index: 0 });
    expect(ofAt(editAsset(WORKSPACE, 'settings', moved.root), 'grid')).toBe('grid');
  });

  it('has a pointer follow a setting renamed inside a group renamed in the same edit', () => {
    const next = editAsset(WORKSPACE, 'settings', renameKey(renameKey(SETTINGS, 'view', 'vista'), 'vista/grid', 'lines'));
    expect(ofAt(next, 'grid')).toBe('vista.lines');
    expect(ofAt(next, 'snap')).toBe('vista.snap');
  });

  it('drops the pointers to a removed setting and keeps the rest', () => {
    const next = editAsset(WORKSPACE, 'settings', removeNodes(SETTINGS, ['view/snap']));
    expect(Object.keys(codeOf(next))).toEqual(['grid']);
  });

  it('keeps a pointer to a live setting whose path is the key of a dropped pointer', () => {
    const dialog: PrefGroup = { ...SETTINGS, children: { ...SETTINGS.children, snap: { kind: 'boolean', name: 'Snap all', description: '', default: false } } };
    const layout: PrefGroup = { ...CODE, children: { ...CODE.children, all: pointer('snap') } };
    const start: Workspace = { assets: WORKSPACE.assets.map((a) => (a.id === 'code' ? { ...a, root: layout } : { ...a, root: dialog })) };
    const next = editAsset(start, 'settings', removeNodes(dialog, ['view/snap']));
    expect(Object.keys(codeOf(next))).toEqual(['grid', 'all']);
  });

  it('leaves a layout as it was when no setting moved or went', () => {
    const next = editAsset(WORKSPACE, 'settings', setAttribute(SETTINGS, 'view/grid', 'description', 'Lines every unit.'));
    expect(assetOf(next, 'code')).toBe(assetOf(WORKSPACE, 'code'));
  });

  it('keeps a pointer that was already dead', () => {
    const dead: PrefAlias = { kind: 'alias', name: '', description: '', default: undefined, of: 'view.nowhere' };
    const start: Workspace = { assets: WORKSPACE.assets.map((a) => (a.id === 'code' ? { ...a, root: { ...CODE, children: { ...CODE.children, lost: dead } } } : a)) };
    const next = editAsset(start, 'settings', removeNodes(SETTINGS, ['view/snap']));
    expect(Object.keys(codeOf(next))).toEqual(['grid', 'lost']);
  });

  it('refuses an edit to a read-only asset', () => {
    const locked: Workspace = { assets: WORKSPACE.assets.map((a) => (a.id === 'code' ? { ...a, readOnly: true } : a)) };
    expect(editAsset(locked, 'code', { ...CODE, children: {} })).toBe(locked);
  });

  it('has a read-only layout follow its settings all the same', () => {
    const locked: Workspace = { assets: WORKSPACE.assets.map((a) => (a.id === 'code' ? { ...a, readOnly: true } : a)) };
    expect(ofAt(editAsset(locked, 'settings', renameKey(SETTINGS, 'view/grid', 'lines')), 'grid')).toBe('view.lines');
  });

  it('edits a layout without touching its dialog', () => {
    const next = editAsset(WORKSPACE, 'code', removeNodes(CODE, ['snap']));
    expect(Object.keys(codeOf(next))).toEqual(['grid']);
    expect(assetOf(next, 'settings')).toBe(assetOf(WORKSPACE, 'settings'));
  });
});
