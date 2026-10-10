import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { GENERAL } from './generalBranch';
import { previewTarget, treeTakesNew } from './previewDrop';

const leaf = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false });
const ROOT: PrefGroup = {
  name: '',
  children: {
    author: leaf('Author'),
    canvas: { name: 'Canvas', children: { grid: leaf('Grid'), snap: leaf('Snap'), box: { name: 'Box', as: 'panel', children: {} } } },
  },
};
const TAB: PrefGroup = { name: 'New tab', as: 'tab', children: {} };
const PAGE: PrefGroup = { name: 'New page', as: 'page', children: {} };

describe('previewTarget', () => {
  it('lands beside the leaf under the pointer, among its siblings', () => {
    expect(previewTarget(ROOT, { path: 'canvas.grid', where: 'before' }, [leaf('X')], [])).toEqual({ parentPath: 'canvas', index: 0 });
    expect(previewTarget(ROOT, { path: 'canvas.grid', where: 'after' }, [leaf('X')], [])).toEqual({ parentPath: 'canvas', index: 1 });
  });

  it('lands at the end of the group under the pointer, the root for the root\'s own page', () => {
    expect(previewTarget(ROOT, { path: 'canvas.box', where: 'into' }, [leaf('X')], [])).toEqual({ parentPath: 'canvas/box', index: 0 });
    expect(previewTarget(ROOT, { path: '', where: 'into' }, [TAB], [])).toEqual({ parentPath: null, index: 2 });
  });

  it('refuses a group dropped into itself, a drop into a leaf, and a path the schema lacks', () => {
    expect(previewTarget(ROOT, { path: 'canvas.box', where: 'into' }, [ROOT.children.canvas!], ['canvas'])).toBeNull();
    expect(previewTarget(ROOT, { path: 'author', where: 'into' }, [leaf('X')], [])).toBeNull();
    expect(previewTarget(ROOT, { path: 'gone', where: 'before' }, [leaf('X')], [])).toBeNull();
    expect(previewTarget(ROOT, null, [leaf('X')], [])).toBeNull();
  });
});

describe('treeTakesNew', () => {
  it('puts what the root\'s own page draws under General, and pages at the top level', () => {
    expect(treeTakesNew(ROOT, TAB, GENERAL)).toBe(true);
    expect(treeTakesNew(ROOT, PAGE, GENERAL)).toBe(false);
    expect(treeTakesNew(ROOT, PAGE, null)).toBe(true);
    expect(treeTakesNew(ROOT, TAB, null)).toBe(false);
    expect(treeTakesNew(ROOT, TAB, 'canvas')).toBe(true);
    expect(treeTakesNew(ROOT, TAB, 'author')).toBe(false);
  });
});
