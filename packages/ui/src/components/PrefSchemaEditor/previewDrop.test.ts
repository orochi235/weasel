import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { GENERAL } from './generalBranch';
import { drawsNode, heldDrop, previewDrop, previewMark, previewTarget, sameDrop, treeTakesNew } from './previewDrop';

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

describe('a drag over the preview', () => {
  it('goes into a rail entry\'s group when it holds a leaf, and beside the entry when it holds only groups', () => {
    const edge = { path: 'canvas', where: 'before', rail: true } as const;
    expect(previewMark(edge, [leaf('X')])).toEqual({ path: 'canvas', where: 'into', rail: true });
    expect(previewMark(edge, [PAGE])).toBe(edge);
    expect(previewMark({ path: 'canvas.grid', where: 'before' }, [leaf('X')])).toEqual({ path: 'canvas.grid', where: 'before' });
    expect(previewTarget(ROOT, edge, [PAGE], [])).toEqual({ parentPath: null, index: 1 });
  });

  it('takes a page into a rail entry\'s group, and nothing that would nest past the depth allowed', () => {
    const into = { path: 'canvas', where: 'into', rail: true } as const;
    expect(previewTarget(ROOT, into, [PAGE], [])).toEqual({ parentPath: 'canvas', index: 3 });
    expect(previewTarget(ROOT, into, [PAGE], [], 2)).toEqual({ parentPath: 'canvas', index: 3 });
    expect(previewTarget(ROOT, into, [PAGE], [], 1)).toBeNull();
    expect(previewTarget(ROOT, into, [leaf('X')], [], 1)).toEqual({ parentPath: 'canvas', index: 3 });
    expect(treeTakesNew(ROOT, PAGE, 'canvas/box', 2)).toBe(false);
    expect(treeTakesNew(ROOT, PAGE, 'canvas/box', 3)).toBe(true);
  });

  it('hands the form the nodes and the value paths they sit at', () => {
    const box = (ROOT.children.canvas as PrefGroup).children.box!;
    expect(previewDrop({ path: 'author', where: 'after' }, [box], ['canvas/box'])).toEqual({ path: 'author', where: 'after', nodes: [box], from: ['canvas.box'] });
  });

  it('is the same drop while it would draw the same form', () => {
    const x = leaf('X');
    const a = previewDrop({ path: 'author', where: 'after' }, [x], []);
    expect(sameDrop(a, previewDrop({ path: 'author', where: 'after' }, [x], []))).toBe(true);
    expect(sameDrop(a, previewDrop({ path: 'author', where: 'before' }, [x], []))).toBe(false);
    expect(sameDrop(a, previewDrop({ path: 'author', where: 'after' }, [leaf('X')], []))).toBe(false);
    expect(sameDrop(a, null)).toBe(false);
    expect(sameDrop(null, null)).toBe(true);
  });

  it('wants no ghost while the form draws the node, which it may not for a drop into a rail entry', () => {
    expect(drawsNode(null)).toBe(false);
    expect(drawsNode({ path: 'author', where: 'after', nodes: [] })).toBe(true);
    expect(drawsNode({ path: 'canvas', where: 'before', rail: true, nodes: [] })).toBe(true);
    expect(drawsNode({ path: 'canvas', where: 'into', rail: true, nodes: [] })).toBe(false);
    expect(drawsNode({ path: '', where: 'home', nodes: [] })).toBe(false);
  });

  it('holds a node of the schema where it sits while it has nowhere to land, and draws nothing for a new one', () => {
    const grid = (ROOT.children.canvas as PrefGroup).children.grid!;
    expect(heldDrop(ROOT, [grid], ['canvas.grid'])).toEqual({ path: '', where: 'home', nodes: [grid], from: ['canvas.grid'] });
    expect(heldDrop(ROOT, [TAB], [])).toBeNull();
    expect(heldDrop({ name: 'Rect', description: '', members: {} }, [grid], ['grid'])).toBeNull();
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
