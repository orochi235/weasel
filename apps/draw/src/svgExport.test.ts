/**
 * Tests for `selectionToSvgString` — the clipboard `produceFlavors`
 * override's SVG source (see `apps/draw/src/App.tsx`). Verifies it walks
 * only the requested ids (not the whole scene) and fits the viewBox to
 * their bounds rather than the page.
 */

import { describe, it, expect } from 'vitest';
import { parseSvg } from '@weasel-js/svg';
import { selectionToSvgString, clipboardSnapshotRootIds } from './svgExport';

// Minimal fake `Scene` — only the members `sceneToSvgNodes`'s `SceneSource`
// plumbing reads (`roots`, `childrenOf`, `get`). Cast through `never` since
// the real `Scene<WeaselDrawData, TLayer, WeaselDrawPose>` type isn't
// exported from svgExport.ts.
function fakeScene(nodes: Record<string, {
  kind: 'leaf' | 'container';
  pose: { x: number; y: number; width: number; height: number };
  data?: { path?: unknown; fill?: string };
  children?: string[];
}>, roots: string[]) {
  return {
    roots,
    get: (id: string) => {
      const n = nodes[id];
      if (!n) return undefined;
      return { kind: n.kind, layer: 'default', pose: n.pose, data: n.data ?? {} };
    },
    childrenOf: (id: string) => nodes[id]?.children ?? [],
  } as never;
}

describe('selectionToSvgString', () => {
  it('emits only the selected subtree, matching the full-scene walk for that node', () => {
    const scene = fakeScene({
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: '#ff0000' },
      },
      b: {
        kind: 'leaf',
        pose: { x: 100, y: 100, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 100, y: 100, width: 10, height: 10 }, fill: '#00ff00' },
      },
    }, ['a', 'b']);

    const svg = selectionToSvgString(scene, ['a']);
    const parsed = parseSvg(svg);

    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0].kind).toBe('path');
    if (parsed.nodes[0].kind !== 'path') throw new Error('expected path');
    expect(parsed.nodes[0].fill).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it('fits the viewBox to the selected node(s), not the full scene', () => {
    const scene = fakeScene({
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: '#ff0000' },
      },
      b: {
        kind: 'leaf',
        pose: { x: 500, y: 500, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 500, y: 500, width: 10, height: 10 }, fill: '#00ff00' },
      },
    }, ['a', 'b']);

    const svg = selectionToSvgString(scene, ['a']);
    const parsed = parseSvg(svg);

    expect(parsed.viewBox).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('unions bounds across multiple selected roots', () => {
    const scene = fakeScene({
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: '#ff0000' },
      },
      b: {
        kind: 'leaf',
        pose: { x: 20, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 20, y: 0, width: 10, height: 10 }, fill: '#00ff00' },
      },
    }, ['a', 'b']);

    const svg = selectionToSvgString(scene, ['a', 'b']);
    const parsed = parseSvg(svg);

    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.viewBox).toEqual({ x: 0, y: 0, width: 30, height: 10 });
  });

  it('walks a selected container subtree (only its descendants, wd:group-id preserved)', () => {
    const scene = fakeScene({
      g1: {
        kind: 'container',
        pose: { x: 0, y: 0, width: 30, height: 10 },
        children: ['a', 'b'],
      },
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: '#ff0000' },
      },
      b: {
        kind: 'leaf',
        pose: { x: 20, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 20, y: 0, width: 10, height: 10 }, fill: '#00ff00' },
      },
      c: {
        kind: 'leaf',
        pose: { x: 500, y: 500, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 500, y: 500, width: 10, height: 10 }, fill: '#0000ff' },
      },
    }, ['g1', 'c']);

    const svg = selectionToSvgString(scene, ['g1']);
    const parsed = parseSvg(svg, { namespaces: { wd: 'https://weaseldraw.app/svg-ext' } });

    expect(parsed.nodes).toHaveLength(1);
    const g = parsed.nodes[0];
    if (g.kind !== 'group') throw new Error('expected group');
    expect(g.meta?.wd?.attrs?.['group-id']).toBe('g1');
    expect(g.children).toHaveLength(2);
    // Bounds come from the container's own pose (the union-AABB convention
    // group creation already maintains), not a re-derivation from children.
    expect(parsed.viewBox).toEqual({ x: 0, y: 0, width: 30, height: 10 });
  });
});

describe('clipboardSnapshotRootIds', () => {
  it('returns the selected roots when the selection is leaves-only', () => {
    const items = [
      { id: 'a', parent: null },
      { id: 'b', parent: null },
    ];
    expect(clipboardSnapshotRootIds(items)).toEqual(['a', 'b']);
  });

  it('excludes descendants a copied container flattens alongside it', () => {
    // Mirrors sceneAdapter.snapshotSelection's shape for a copied group:
    // the container plus its full subtree, parents-before-children.
    const items = [
      { id: 'g1', parent: null },
      { id: 'a', parent: 'g1' },
      { id: 'b', parent: 'g1' },
    ];
    expect(clipboardSnapshotRootIds(items)).toEqual(['g1']);
  });

  it('treats an item whose parent is outside the snapshot as its own root', () => {
    // e.g. a selected child of an unselected container — snapshotSelection
    // still only captures the selected node itself.
    const items = [{ id: 'a', parent: 'not-in-snapshot' }];
    expect(clipboardSnapshotRootIds(items)).toEqual(['a']);
  });

  it('handles multiple independent copied groups', () => {
    const items = [
      { id: 'g1', parent: null },
      { id: 'a', parent: 'g1' },
      { id: 'g2', parent: null },
      { id: 'b', parent: 'g2' },
    ];
    expect(clipboardSnapshotRootIds(items)).toEqual(['g1', 'g2']);
  });
});
