import { describe, expect, it } from 'vitest';
import { describePresets, FEATURE_PRESETS, type PresetDescription } from '@weasel-js/core';
import { aliasNodes, copyNodes } from './schemaEdit';
import { bundleLoads, bundleProblems } from './bundleChecks';
import { BUNDLE_LINKS, bundleTree } from './bundleTree';

const d = (id: string, more: Partial<PresetDescription> = {}): PresetDescription =>
  ({ id, label: id, package: 'pkg', atom: false, actions: [], tools: [], includes: [], ...more });

describe('bundleProblems', () => {
  it("finds nothing wrong with core's presets as they stand", () => {
    expect(bundleProblems(bundleTree(describePresets({ '@weasel-js/core': Object.values(FEATURE_PRESETS) })))).toEqual(new Map());
  });

  it('marks a bundle that includes itself, and the link that closes the loop', () => {
    const tree = bundleTree([d('a'), d('b', { includes: ['a'] })]);
    const looped = aliasNodes(tree, ['pkg/b'], { parentPath: 'pkg/a', index: 0 }, BUNDLE_LINKS).root;
    const problems = bundleProblems(looped);
    expect(problems.get('pkg/a')).toEqual({ cycle: true });
    expect(problems.get('pkg/b')).toEqual({ cycle: true });
    expect(problems.get('pkg/a/b')).toEqual({ cycle: true });
    expect(problems.get('pkg/b/a')).toEqual({ cycle: true });
  });

  it('marks an id two bundles name where one bundle loads both, and not where none does', () => {
    const apart = bundleTree([d('a', { actions: ['x'] }), d('b', { actions: ['y'] })]);
    const both = copyNodes(apart, ['pkg/a/x'], { parentPath: 'pkg/b', index: 0 }).root;
    expect(bundleProblems(both).size).toBe(0);
    const together = bundleTree([d('a', { actions: ['x'] }), d('b', { actions: ['x'] }), d('top', { includes: ['a', 'b'] })]);
    const problems = bundleProblems(together);
    expect(problems.get('pkg/a/x')?.twice).toMatch(/a and b both name it, and top loads them together/);
    expect(problems.get('pkg/b/x')?.twice).toBeDefined();
  });

  it("marks an atom whose own action a bundle loaded with it names", () => {
    const tree = bundleTree([d('resize', { atom: true, actions: ['resize'] }), d('top', { actions: ['resize'], includes: ['resize'] })]);
    const problems = bundleProblems(tree);
    expect(problems.get('pkg/top/resize')?.twice).toBeDefined();
    expect(problems.get('pkg/top/resize2')?.twice).toBeDefined();
  });
});

describe('bundleLoads', () => {
  it('gathers what a bundle reaches through its includes and its atoms', () => {
    const tree = bundleTree([d('atom', { atom: true, actions: ['z'] }), d('inner', { actions: ['y'] }), d('top', { actions: ['x'], includes: ['inner', 'atom'] })]);
    expect(bundleLoads(tree, 'top')).toEqual({ holders: ['top', 'inner', 'atom'], names: ['atom:atom', 'action:x', 'action:y', 'action:z'] });
  });
});
