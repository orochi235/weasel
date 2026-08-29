/**
 * Tests for `selectionToSvgString` — the clipboard `produceFlavors`
 * override's SVG source (see `apps/draw/src/App.tsx`). Verifies it walks
 * only the requested ids (not the whole scene) and fits the viewBox to
 * their bounds rather than the page.
 */

import { describe, it, expect } from 'vitest';
import { parseSvg } from '@weasel-js/svg';
import type { TextStyle } from '@weasel-js/core';
import { svgNodesToSceneDrafts } from './svgInterop';
import { buildWeaselClipboardText, extractWeaselClipboardFromSvg } from '@weasel-js/core';
import { solid, strokeOf } from '@weasel-js/core';
import type { FillStyle, Stroke } from '@weasel-js/core';
import {
  selectionToSvgString,
  selectionToClipboardSvgString,
  clipboardSnapshotRootIds,
} from './svgExport';

// Minimal fake `Scene` — only the members `sceneToSvgNodes`'s `SceneSource`
// plumbing reads (`roots`, `childrenOf`, `get`). Cast through `never` since
// the real `Scene<WeaselDrawData, TLayer, WeaselDrawPose>` type isn't
// exported from svgExport.ts.
function fakeScene(nodes: Record<string, {
  kind: 'leaf' | 'container';
  pose: { x: number; y: number; width: number; height: number; rotation?: number };
  data?: {
    path?: unknown; fill?: FillStyle | null; text?: string; style?: unknown;
    stroke?: Stroke | null;
  };
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

describe('text export', () => {
  /**
   * A text node's typography lives in `data.style` and its paint in
   * `data.fill` / `data.stroke`, the way `kit:shape` reads them. Export
   * dropped all of it, so a styled text node came back as unstyled black
   * text.
   */
  it('carries the node style through to the <text> element', () => {
    const scene = fakeScene({
      t: {
        kind: 'leaf',
        pose: { x: 5, y: 6, width: 120, height: 40 },
        data: {
          text: 'Hi',
          style: { fontSize: 32, fontFamily: 'Inter' },
          fill: { fill: 'solid', color: '#123456' },
        },
      },
    }, ['t']);

    const parsed = parseSvg(selectionToSvgString(scene, ['t']));
    const n = parsed.nodes[0];
    if (n.kind !== 'text') throw new Error('expected text');
    expect(n.style?.fontSize).toBe(32);
    expect(n.style?.fontFamily).toBe('Inter');
    expect(n.fill).toEqual({ fill: 'solid', color: '#123456' });
  });

  it('exports the leaf stroke as a text stroke', () => {
    const scene = fakeScene({
      t: {
        kind: 'leaf',
        pose: { x: 5, y: 6, width: 120, height: 40 },
        data: { text: 'Hi', style: { fontSize: 32 }, stroke: strokeOf('#c0392b', 3) },
      },
    }, ['t']);

    const parsed = parseSvg(selectionToSvgString(scene, ['t']));
    const n = parsed.nodes[0];
    if (n.kind !== 'text') throw new Error('expected text');
    expect(n.stroke).toEqual({ paint: { fill: 'solid', color: '#c0392b' }, width: 3 });
  });

  it('survives the whole loop: scene → SVG → parse → import drafts', () => {
    const scene = fakeScene({
      t: {
        kind: 'leaf',
        pose: { x: 5, y: 6, width: 120, height: 40 },
        data: { text: 'Hi', style: { fontSize: 32 }, stroke: strokeOf('#c0392b', 3) },
      },
    }, ['t']);

    const parsed = parseSvg(selectionToSvgString(scene, ['t']));
    let n = 0;
    const drafts = svgNodesToSceneDrafts(parsed.nodes, () => `n${n++}`);
    const leaf = drafts.find(
      (d) => 'obj' in d && (d as { obj?: { tool?: string } }).obj?.tool === 'text',
    ) as { obj: { style?: TextStyle; stroke?: Stroke } };

    expect(leaf.obj.style?.fontSize).toBe(32);
    expect(leaf.obj.stroke).toEqual({
      paint: { fill: 'solid', color: '#c0392b' },
      width: 3,
    });
  });

  it('does not invent a stroke for a null or absent one', () => {
    for (const data of [
      { text: 'Hi', stroke: null },
      { text: 'Hi' },
    ]) {
      const scene = fakeScene({
        t: { kind: 'leaf', pose: { x: 0, y: 0, width: 50, height: 20 }, data },
      }, ['t']);
      const parsed = parseSvg(selectionToSvgString(scene, ['t']));
      const n = parsed.nodes[0];
      if (n.kind !== 'text') throw new Error('expected text');
      expect(n.stroke).toBeUndefined();
    }
  });
});

describe('selectionToSvgString', () => {
  it('emits only the selected subtree, matching the full-scene walk for that node', () => {
    const scene = fakeScene({
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: solid('#ff0000') },
      },
      b: {
        kind: 'leaf',
        pose: { x: 100, y: 100, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 100, y: 100, width: 10, height: 10 }, fill: solid('#00ff00') },
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
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: solid('#ff0000') },
      },
      b: {
        kind: 'leaf',
        pose: { x: 500, y: 500, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 500, y: 500, width: 10, height: 10 }, fill: solid('#00ff00') },
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
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: solid('#ff0000') },
      },
      b: {
        kind: 'leaf',
        pose: { x: 20, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 20, y: 0, width: 10, height: 10 }, fill: solid('#00ff00') },
      },
    }, ['a', 'b']);

    const svg = selectionToSvgString(scene, ['a', 'b']);
    const parsed = parseSvg(svg);

    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.viewBox).toEqual({ x: 0, y: 0, width: 30, height: 10 });
  });

  it('fits the viewBox to a rotated node\'s ink, not its unrotated pose box', () => {
    const scene = fakeScene({
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 40, height: 10, rotation: Math.PI / 2 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 40, height: 10 }, fill: solid('#ff0000') },
      },
    }, ['a']);

    const parsed = parseSvg(selectionToSvgString(scene, ['a']));

    // The quarter-turned rect occupies x 15..25, y -15..25.
    expect(parsed.viewBox!.y).toBeCloseTo(-15);
    expect(parsed.viewBox!.height).toBeCloseTo(40);
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
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: solid('#ff0000') },
      },
      b: {
        kind: 'leaf',
        pose: { x: 20, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 20, y: 0, width: 10, height: 10 }, fill: solid('#00ff00') },
      },
      c: {
        kind: 'leaf',
        pose: { x: 500, y: 500, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 500, y: 500, width: 10, height: 10 }, fill: solid('#0000ff') },
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

describe('selectionToClipboardSvgString', () => {
  const scene = () => fakeScene({
    a: {
      kind: 'leaf',
      pose: { x: 0, y: 0, width: 10, height: 10 },
      data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: solid('#ff0000') },
    },
  }, ['a']);
  // A payload with a field the SVG mapping drops (label) — surviving the
  // text/plain round-trip is the point of the metadata embed.
  const payload = () => buildWeaselClipboardText([
    { id: 'a', parent: null, pose: { x: 0, y: 0, width: 10, height: 10 }, data: { fill: solid('#ff0000'), label: 'my label' } },
  ]);

  it('embeds the weasel payload extractably, byte-equal to the JSON flavor text', () => {
    const svg = selectionToClipboardSvgString(scene(), ['a'], payload());
    expect(extractWeaselClipboardFromSvg(svg)).toBe(payload());
  });

  it('external parse is unaffected: parseSvg succeeds and renders the same shapes', () => {
    const plain = parseSvg(selectionToSvgString(scene(), ['a']));
    const withMeta = parseSvg(selectionToClipboardSvgString(scene(), ['a'], payload()));
    expect(withMeta.warnings).toEqual(plain.warnings);
    expect(withMeta.nodes).toEqual(plain.nodes);
    expect(withMeta.nodes).toHaveLength(1);
    expect(withMeta.viewBox).toEqual(plain.viewBox);
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


describe('gradient fills', () => {
  const STOPS = [
    { offset: 0, color: '#ff0000' },
    { offset: 1, color: '#0000ff' },
  ];

  /** A node at (100,50) sized 200x100, filled left-to-right across its box. */
  function gradientScene() {
    return fakeScene({
      a: {
        kind: 'leaf',
        pose: { x: 100, y: 50, width: 200, height: 100 },
        data: {
          path: { kind: 'rect', x: 100, y: 50, width: 200, height: 100 },
          fill: {
            fill: 'linear-gradient',
            from: { x: 0, y: 0.5 },
            to: { x: 1, y: 0.5 },
            stops: STOPS,
            units: 'bounds',
          },
        },
      },
    }, ['a']);
  }

  it('resolves box-relative coordinates against the pose, not into a corner', () => {
    const svg = selectionToSvgString(gradientScene(), ['a']);
    const parsed = parseSvg(svg);
    const n = parsed.nodes[0];
    if (n.kind !== 'path') throw new Error('expected path');
    if (n.fill.kind !== 'gradient') throw new Error('expected a gradient fill');
    const paint = n.fill.paint as { fill: string; from: { x: number; y: number }; to: { x: number; y: number } };
    expect(paint.fill).toBe('linear-gradient');
    // Spans the node's own box in page coordinates — a `0..1` emission
    // would have been a 1px smear at the origin.
    expect(paint.from).toEqual({ x: 100, y: 100 });
    expect(paint.to).toEqual({ x: 300, y: 100 });
  });

  it('emits the stops in order', () => {
    const svg = selectionToSvgString(gradientScene(), ['a']);
    const parsed = parseSvg(svg);
    const n = parsed.nodes[0];
    if (n.kind !== 'path' || n.fill.kind !== 'gradient') throw new Error('expected a gradient fill');
    const paint = n.fill.paint as { stops: { offset: number; color: string }[] };
    expect(paint.stops.map((s) => s.offset)).toEqual([0, 1]);
    expect(paint.stops.map((s) => s.color.slice(0, 7))).toEqual(['#ff0000', '#0000ff']);
  });

  it('re-imports as a box-relative gradient, so it still tracks its node', () => {
    const svg = selectionToSvgString(gradientScene(), ['a']);
    let n = 0;
    const drafts = svgNodesToSceneDrafts(parseSvg(svg).nodes, () => `n${n++}`);
    const leaf = drafts.find((d) => d.kind === 'leaf');
    if (leaf?.kind !== 'leaf') throw new Error('expected a leaf draft');
    if (leaf.obj.tool === 'text') throw new Error('expected a path draft');
    const fill = leaf.obj.fill as {
      fill: string; units: string; from: { x: number; y: number }; to: { x: number; y: number };
    };
    expect(fill.fill).toBe('linear-gradient');
    expect(fill.units).toBe('bounds');
    expect(fill.from.x).toBeCloseTo(0);
    expect(fill.from.y).toBeCloseTo(0.5);
    expect(fill.to.x).toBeCloseTo(1);
    expect(fill.to.y).toBeCloseTo(0.5);
  });
});
