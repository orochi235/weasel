import { describe, expect, it } from 'vitest';
import { describePresets, FEATURE_PRESETS, type PresetDescription } from '@weasel-js/core';
import { addNode, moveNodes, removeNodes, renameKey, setAttribute } from './schemaEdit';
import { bundleChanges, bundlesDocument, presetsHash } from './bundleExport';
import { bundleTree } from './bundleTree';

const CORE = describePresets({ '@weasel-js/core': Object.values(FEATURE_PRESETS) });
const BASE = bundleTree(CORE);

const d = (id: string, more: Partial<PresetDescription> = {}): PresetDescription =>
  ({ id, label: id, package: 'pkg', atom: false, actions: [], tools: [], includes: [], ...more });

describe('bundlesDocument', () => {
  it('has no changes and no bundles for a tree as it was made', () => {
    expect(bundlesDocument(CORE, BASE, BASE)).toEqual({ format: 'weasel-bundles/1', base: presetsHash(CORE), bundles: [], changes: [] });
  });

  it('makes one move of one action from one bundle to another, and lists the package it touched as edited', () => {
    const moved = moveNodes(BASE, ['core/delete/delete'], { parentPath: 'core/edit', index: 0 }).root;
    const doc = bundlesDocument(CORE, BASE, moved);
    expect(doc.changes).toEqual([{ op: 'move', kind: 'action', id: 'delete', from: 'delete', to: 'edit' }]);
    expect(doc.bundles.find((b) => b.id === 'edit')!.members[0]).toEqual({ kind: 'action', id: 'delete' });
    expect(doc.bundles.every((b) => b.package === '@weasel-js/core')).toBe(true);
  });

  it('hashes the descriptions it was made from, and another set to another hash', () => {
    expect(presetsHash(CORE)).toMatch(/^[0-9a-f]{16}$/);
    expect(presetsHash(CORE.slice(1))).not.toBe(presetsHash(CORE));
  });
});

describe('bundleChanges', () => {
  const all = [d('a', { actions: ['x'] }), d('b', { includes: ['a'] }), d('c', { tools: ['rect'] })];
  const base = bundleTree(all);

  it('says a bundle was renamed, relabeled, made, and removed', () => {
    let tree = renameKey(base, 'pkg/a', 'alpha');
    tree = setAttribute(tree, 'pkg/c', 'name', 'Sea');
    tree = addNode(tree, 'pkg', 'fresh', { name: 'Fresh', description: '', children: {} });
    tree = removeNodes(tree, ['pkg/b']);
    expect(bundleChanges(base, tree)).toEqual([
      { op: 'create', kind: 'bundle', id: 'fresh', package: 'pkg', label: 'Fresh' },
      { op: 'rename', kind: 'bundle', id: 'a', to: 'alpha' },
      { op: 'rename', kind: 'bundle', id: 'c', label: 'Sea' },
      { op: 'remove', kind: 'bundle', id: 'b' },
    ]);
  });

  it('says a member joined or left a bundle, and an include of a renamed bundle by its new id', () => {
    let tree = renameKey(base, 'pkg/a', 'alpha');
    tree = removeNodes(tree, ['pkg/c/rect']);
    expect(bundleChanges(base, tree)).toEqual([
      { op: 'rename', kind: 'bundle', id: 'a', to: 'alpha' },
      { op: 'exclude', kind: 'tool', id: 'rect', bundle: 'c' },
    ]);
  });
});
