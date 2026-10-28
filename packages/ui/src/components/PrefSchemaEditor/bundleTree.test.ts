import { describe, expect, it } from 'vitest';
import { describePresets, FEATURE_PRESETS, type PresetDescription } from '@weasel-js/core';
import { aliasNodes, moveNodes, nodeAt, removeNodes, renameKey } from './schemaEdit';
import { BUNDLE_LINKS, bundleParts, bundleTree, isBundleAt, membership, readBundles, type BundleMember } from './bundleTree';

const CORE = describePresets({ '@weasel-js/core': Object.values(FEATURE_PRESETS) });

const d = (id: string, more: Partial<PresetDescription> = {}): PresetDescription =>
  ({ id, label: id, package: 'pkg', atom: false, actions: [], tools: [], includes: [], ...more });

/** A description's members as a bundle tree reads them back. */
const membersOf = (desc: PresetDescription, all: readonly PresetDescription[]): BundleMember[] => [
  ...desc.includes.map((id): BundleMember => ({ kind: all.find((x) => x.id === id)!.atom ? 'atom' : 'bundle', id })),
  ...desc.actions.map((id): BundleMember => ({ kind: 'action', id })),
  ...desc.tools.map((id): BundleMember => ({ kind: 'tool', id })),
];

describe('bundleTree', () => {
  it("reads back every core bundle with the members describePresets gave it, and no atom as a bundle", () => {
    const read = readBundles(bundleTree(CORE));
    const bundles = CORE.filter((x) => !x.atom);
    expect(read.map((b) => b.id)).toEqual(bundles.map((b) => b.id));
    for (const b of bundles) {
      const got = read.find((r) => r.id === b.id)!;
      expect(got.members, b.id).toEqual(membersOf(b, CORE));
      expect(got.package).toBe('@weasel-js/core');
      expect(got.label).toBe(b.label);
    }
  });

  it('files a section per package, and an atom no bundle includes on its own in its section', () => {
    const tree = bundleTree([d('loose', { atom: true, actions: ['a'] }), d('b', { package: '@x/path-tools', includes: [] })]);
    expect(Object.keys(tree.children)).toEqual(['pkg', 'pathTools']);
    expect(tree.children.pkg).toMatchObject({ name: 'pkg', as: 'section' });
    expect(nodeAt(tree, 'pkg/loose')).toMatchObject({ kind: 'atom', atom: 'loose', actions: ['a'] });
    expect(isBundleAt(tree, 'pathTools/b')).toBe(true);
  });

  it('keys an id that is no key by its words, and reads the id back', () => {
    const tree = bundleTree(CORE);
    expect(nodeAt(tree, 'core/toolsSelect')).toBeDefined();
    expect(readBundles(tree).some((b) => b.id === 'tools:select')).toBe(true);
  });

  it('makes an include a link that follows its bundle through a rename and a move, and goes with it', () => {
    const all = [d('inner', { actions: ['x'] }), d('outer', { includes: ['inner'] }), d('other')];
    const tree = bundleTree(all);
    expect(nodeAt(tree, 'pkg/outer/inner')).toMatchObject({ kind: 'alias', of: 'pkg.inner' });
    const renamed = renameKey(tree, 'pkg/inner', 'core2');
    expect(readBundles(renamed).find((b) => b.id === 'outer')!.members).toEqual([{ kind: 'bundle', id: 'core2' }]);
    const gone = removeNodes(tree, ['pkg/inner']);
    expect(readBundles(gone).find((b) => b.id === 'outer')!.members).toEqual([]);
  });

  it('links a bundle by the link drag, and refuses a leaf that names one thing', () => {
    const tree = bundleTree([d('a', { actions: ['x'] }), d('b')]);
    expect(BUNDLE_LINKS.can(tree, 'pkg/a')).toBe(true);
    expect(BUNDLE_LINKS.can(tree, 'pkg/a/x')).toBe(false);
    const linked = aliasNodes(tree, ['pkg/a'], { parentPath: 'pkg/b', index: 0 }, BUNDLE_LINKS);
    expect(readBundles(linked.root).find((b) => b.id === 'b')!.members).toEqual([{ kind: 'bundle', id: 'a' }]);
  });

  it('lists every part once, and the bundles each is in', () => {
    const all = [d('a', { actions: ['x', 'y'], tools: ['rect'] }), d('b', { actions: ['x'] }), d('atom', { atom: true })];
    const parts = bundleParts(all);
    expect(Object.keys((parts.children.actions as { children: object }).children)).toEqual(['x', 'y']);
    expect(Object.keys((parts.children.atoms as { children: object }).children)).toEqual(['atom']);
    const tree = moveNodes(bundleTree(all), ['pkg/a/y'], { parentPath: 'pkg/b', index: 0 }).root;
    expect(membership(tree).get('action:x')).toEqual(['a', 'b']);
    expect(membership(tree).get('action:y')).toEqual(['b']);
  });
});
