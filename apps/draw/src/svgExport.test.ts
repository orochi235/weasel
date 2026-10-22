/**
 * Tests for `selectionToSvgString` — the clipboard `produceFlavors`
 * override's SVG source (see `apps/draw/src/App.tsx`). Verifies it walks
 * only the requested ids (not the whole scene) and fits the viewBox to
 * their bounds rather than the page.
 */

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { parseSvg } from '@weasel-js/svg';
import { boundsOfPath, IDENTITY_POSE_COMPOSITION, RIGID_POSE_COMPOSITION, type TextStyle } from '@weasel-js/core';
import { parsedToDoc, svgNodesToSceneDrafts, SWILL_NAMESPACES } from './svgInterop';
import { leafOfObj } from './svgImport';
import { buildWeaselClipboardText, extractWeaselClipboardFromSvg } from '@weasel-js/core';
import { asPaint, createScene, measureNode, registerPaintKindLoader, solid, strokeOf } from '@weasel-js/core';
import { ANNOTATION_LAYER, DRAW_LAYERS, type WeaselDrawData, type WeaselDrawLayer, type WeaselDrawPose } from './drawDocument';
import type { Stroke, StyledRun, Fill } from '@weasel-js/core';
import {
  sceneToSvgString,
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
    path?: unknown; fill?: Fill | null; text?: string; style?: unknown;
    runs?: StyledRun[]; stroke?: Stroke | null; image?: unknown;
  };
  children?: string[];
  dependsOn?: readonly string[];
  derivePose?: () => { x: number; y: number; width: number; height: number } | null;
}>, roots: string[], composition: unknown = IDENTITY_POSE_COMPOSITION) {
  const parentOf = new Map<string, string>();
  for (const [id, n] of Object.entries(nodes)) for (const c of n.children ?? []) parentOf.set(c, id);
  return {
    roots,
    composition,
    get: (id: string) => {
      const n = nodes[id];
      if (!n) return undefined;
      return {
        id, kind: n.kind, layer: 'default', pose: n.pose, data: n.data ?? {},
        parent: parentOf.get(id) ?? null,
        ...(n.dependsOn ? { dependsOn: n.dependsOn, derivePose: n.derivePose } : {}),
      };
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
  it('carries the node style through to the <text> element', async () => {
    const scene = fakeScene({
      t: {
        kind: 'leaf',
        pose: { x: 5, y: 6, width: 120, height: 40 },
        data: {
          text: 'Hi',
          style: { fontSize: 32, fontFamily: 'Inter' },
          fill: { paint: { kind: 'solid', color: '#123456' } },
        },
      },
    }, ['t']);

    const parsed = parseSvg(await selectionToSvgString(scene, ['t']));
    const n = parsed.nodes[0];
    if (n.kind !== 'text') throw new Error('expected text');
    expect(n.style?.fontSize).toBe(32);
    expect(n.style?.fontFamily).toBe('Inter');
    expect(n.fill).toEqual({ paint: { kind: 'solid', color: '#123456' } });
  });

  it('exports the leaf stroke as a text stroke', async () => {
    const scene = fakeScene({
      t: {
        kind: 'leaf',
        pose: { x: 5, y: 6, width: 120, height: 40 },
        data: { text: 'Hi', style: { fontSize: 32 }, stroke: strokeOf('#c0392b', 3) },
      },
    }, ['t']);

    const parsed = parseSvg(await selectionToSvgString(scene, ['t']));
    const n = parsed.nodes[0];
    if (n.kind !== 'text') throw new Error('expected text');
    expect(n.stroke).toEqual({ paint: { kind: 'solid', color: '#c0392b' }, width: 3 });
  });

  it('writes text with no fill, which paints no glyphs, as fill="none"', async () => {
    const scene = fakeScene({
      t: { kind: 'leaf', pose: { x: 5, y: 6, width: 120, height: 40 }, data: { text: 'Hi' } },
    }, ['t']);
    const n = parseSvg(await selectionToSvgString(scene, ['t'])).nodes[0];
    if (n.kind !== 'text') throw new Error('expected text');
    expect(n.fill).toBeNull();
  });

  it('keeps unfilled text unfilled through scene → SVG → parse → import drafts', async () => {
    const scene = fakeScene({
      t: {
        kind: 'leaf',
        pose: { x: 5, y: 6, width: 120, height: 40 },
        data: { text: 'Hi', style: { fontSize: 32 }, fill: null, stroke: strokeOf('#c0392b', 3) },
      },
    }, ['t']);

    const svg = await selectionToSvgString(scene, ['t']);
    expect(svg).toMatch(/<text[^>]*fill="none"/);
    let n = 0;
    const drafts = svgNodesToSceneDrafts(parseSvg(svg).nodes, () => `n${n++}`);
    const leaf = drafts.find(
      (d) => 'obj' in d && (d as { obj?: { tool?: string } }).obj?.tool === 'text',
    ) as { obj: { fill?: Fill | null } };
    expect(leaf.obj.fill).toBeNull();
  });

  it('survives the whole loop: scene → SVG → parse → import drafts', async () => {
    const scene = fakeScene({
      t: {
        kind: 'leaf',
        pose: { x: 5, y: 6, width: 120, height: 40 },
        data: { text: 'Hi', style: { fontSize: 32 }, stroke: strokeOf('#c0392b', 3) },
      },
    }, ['t']);

    const parsed = parseSvg(await selectionToSvgString(scene, ['t']));
    let n = 0;
    const drafts = svgNodesToSceneDrafts(parsed.nodes, () => `n${n++}`);
    const leaf = drafts.find(
      (d) => 'obj' in d && (d as { obj?: { tool?: string } }).obj?.tool === 'text',
    ) as { obj: { style?: TextStyle; stroke?: Stroke } };

    expect(leaf.obj.style?.fontSize).toBe(32);
    expect(leaf.obj.stroke).toEqual({
      paint: { kind: 'solid', color: '#c0392b' },
      width: 3,
    });
  });

  it('carries run styling through export and back into import drafts', async () => {
    const runs: StyledRun[] = [
      { text: 'Plain ' },
      { text: 'bold', bold: true, fill: { paint: { kind: 'solid', color: '#c0392b' } } },
      { text: ' and ', italic: true, fontSize: 20, underline: true, strikethrough: true },
      { text: '2', fontScale: 0.5, baselineShift: 0.4 },
    ];
    const scene = fakeScene({
      t: {
        kind: 'leaf',
        pose: { x: 5, y: 6, width: 200, height: 40 },
        data: { text: 'Plain bold and 2', style: { fontSize: 32 }, runs },
      },
    }, ['t']);

    const parsed = parseSvg(await selectionToSvgString(scene, ['t']));
    const n = parsed.nodes[0];
    if (n.kind !== 'text') throw new Error('expected text');
    expect(n.runs).toEqual(runs);

    let id = 0;
    const drafts = svgNodesToSceneDrafts(parsed.nodes, () => `n${id++}`);
    const leaf = drafts.find(
      (d) => 'obj' in d && (d as { obj?: { tool?: string } }).obj?.tool === 'text',
    ) as { obj: { runs?: StyledRun[] } };
    expect(leaf.obj.runs).toEqual(runs);
  });

  it('does not invent a stroke for a null or absent one', async () => {
    for (const data of [
      { text: 'Hi', stroke: null },
      { text: 'Hi' },
    ]) {
      const scene = fakeScene({
        t: { kind: 'leaf', pose: { x: 0, y: 0, width: 50, height: 20 }, data },
      }, ['t']);
      const parsed = parseSvg(await selectionToSvgString(scene, ['t']));
      const n = parsed.nodes[0];
      if (n.kind !== 'text') throw new Error('expected text');
      expect(n.stroke).toBeUndefined();
    }
  });
});

describe('Save then Open', () => {
  const PAGE = { filename: 'page', paperSize: 'letter', paperWidth: 100, paperHeight: 100, backgroundColor: '#ffffff' } as const;

  it('keeps a rectangle with fill None unfilled', async () => {
    const scene = fakeScene({
      r: {
        kind: 'leaf',
        pose: { x: 10, y: 20, width: 30, height: 40 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 30, height: 40 }, fill: null, stroke: strokeOf('#00ff00', 2) },
      },
    }, ['r']);

    const svg = await sceneToSvgString(scene, PAGE);
    let n = 0;
    const drafts = svgNodesToSceneDrafts(parseSvg(svg), () => `n${n++}`);
    expect(drafts).toHaveLength(1);
    if (drafts[0].kind !== 'leaf') throw new Error('expected a leaf');
    const { data } = leafOfObj(drafts[0].obj);
    expect(data.fill).toBeNull();
    expect(data.stroke).toMatchObject({ paint: { color: '#00ff00' }, width: 2 });
  });
});

describe('Export leaves annotations out', () => {
  it('writes the content and none of the measurements', async () => {
    const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: DRAW_LAYERS });
    scene.add({
      kind: 'leaf', layer: 'default', pose: { x: 10, y: 20, width: 30, height: 40 },
      data: { path: { kind: 'rect', x: 0, y: 0, width: 30, height: 40 }, fill: { paint: solid('#ff0000') } },
    });
    scene.add(measureNode(scene.mintId(), ANNOTATION_LAYER, { x: 0, y: 0 }, { x: 50, y: 50 }) as never);
    const svg = await sceneToSvgString(scene, {
      filename: 'page', paperSize: 'letter', paperWidth: 100, paperHeight: 100, backgroundColor: '#ffffff',
    });
    let n = 0;
    expect(svgNodesToSceneDrafts(parseSvg(svg), () => `n${n++}`)).toHaveLength(1);
  });
});

describe('Export writes hidden nodes hidden', () => {
  it('writes a hidden node with display="none", and none for a hidden layer', async () => {
    const scene = createScene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>({ systemLayers: DRAW_LAYERS });
    const shown = { path: { kind: 'rect' as const, x: 0, y: 0, width: 30, height: 40 }, fill: { paint: solid('#ff0000') } };
    scene.add({ kind: 'leaf', layer: 'default', pose: { x: 10, y: 20, width: 30, height: 40 }, data: shown });
    const off = scene.add({ kind: 'leaf', layer: 'default', pose: { x: 50, y: 20, width: 30, height: 40 }, data: shown });
    scene.setHidden(off, true);
    const svg = await sceneToSvgString(scene, {
      filename: 'page', paperSize: 'letter', paperWidth: 100, paperHeight: 100, backgroundColor: '#ffffff',
    });
    expect(svg.match(/display="none"/g)).toHaveLength(1);
    expect(parseSvg(svg).nodes).toHaveLength(1);
  });
});

describe('Save then Open: the page background', () => {
  it('comes back as the document background, not as a node', async () => {
    const scene = fakeScene({
      r: {
        kind: 'leaf',
        pose: { x: 10, y: 20, width: 30, height: 40 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 30, height: 40 }, fill: { paint: solid('#ff0000') } },
      },
    }, ['r']);
    const svg = await sceneToSvgString(scene, {
      filename: 'page', paperSize: 'letter', paperWidth: 100, paperHeight: 100, backgroundColor: '#ffffcc',
    });

    const parsed = parseSvg(svg, { namespaces: SWILL_NAMESPACES });
    let n = 0;
    const drafts = svgNodesToSceneDrafts(parsed, () => `n${n++}`);
    expect(drafts).toHaveLength(1);
    expect(parsedToDoc(parsed).backgroundColor).toBe('#ffffcc');
  });

  it('leaves an ordinary page-sized rectangle in a foreign SVG as a node', () => {
    const parsed = parseSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
      + '<rect x="0" y="0" width="100" height="100" fill="#ffffcc"/></svg>',
      { namespaces: SWILL_NAMESPACES },
    );
    let n = 0;
    expect(svgNodesToSceneDrafts(parsed, () => `n${n++}`)).toHaveLength(1);
    expect(parsedToDoc(parsed).backgroundColor).toBeUndefined();
  });
});

describe('selectionToSvgString', () => {
  it('emits only the selected subtree, matching the full-scene walk for that node', async () => {
    const scene = fakeScene({
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: solid('#ff0000') } },
      },
      b: {
        kind: 'leaf',
        pose: { x: 100, y: 100, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 100, y: 100, width: 10, height: 10 }, fill: { paint: solid('#00ff00') } },
      },
    }, ['a', 'b']);

    const svg = await selectionToSvgString(scene, ['a']);
    const parsed = parseSvg(svg);

    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.nodes[0].kind).toBe('path');
    if (parsed.nodes[0].kind !== 'path') throw new Error('expected path');
    expect(parsed.nodes[0].fill).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it('fits the viewBox to the selected node(s), not the full scene', async () => {
    const scene = fakeScene({
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: solid('#ff0000') } },
      },
      b: {
        kind: 'leaf',
        pose: { x: 500, y: 500, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 500, y: 500, width: 10, height: 10 }, fill: { paint: solid('#00ff00') } },
      },
    }, ['a', 'b']);

    const svg = await selectionToSvgString(scene, ['a']);
    const parsed = parseSvg(svg);

    expect(parsed.viewBox).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('unions bounds across multiple selected roots', async () => {
    const scene = fakeScene({
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: solid('#ff0000') } },
      },
      b: {
        kind: 'leaf',
        pose: { x: 20, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 20, y: 0, width: 10, height: 10 }, fill: { paint: solid('#00ff00') } },
      },
    }, ['a', 'b']);

    const svg = await selectionToSvgString(scene, ['a', 'b']);
    const parsed = parseSvg(svg);

    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.viewBox).toEqual({ x: 0, y: 0, width: 30, height: 10 });
  });

  it('fits the viewBox to a rotated node\'s ink, not its unrotated pose box', async () => {
    const scene = fakeScene({
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 40, height: 10, rotation: Math.PI / 2 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 40, height: 10 }, fill: { paint: solid('#ff0000') } },
      },
    }, ['a']);

    const parsed = parseSvg(await selectionToSvgString(scene, ['a']));

    // The quarter-turned rect occupies x 15..25, y -15..25.
    expect(parsed.viewBox!.y).toBeCloseTo(-15);
    expect(parsed.viewBox!.height).toBeCloseTo(40);
  });

  it('walks a selected container subtree (only its descendants, wd:group-id preserved)', async () => {
    const scene = fakeScene({
      g1: {
        kind: 'container',
        pose: { x: 0, y: 0, width: 30, height: 10 },
        children: ['a', 'b'],
      },
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: solid('#ff0000') } },
      },
      b: {
        kind: 'leaf',
        pose: { x: 20, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 20, y: 0, width: 10, height: 10 }, fill: { paint: solid('#00ff00') } },
      },
      c: {
        kind: 'leaf',
        pose: { x: 500, y: 500, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 500, y: 500, width: 10, height: 10 }, fill: { paint: solid('#0000ff') } },
      },
    }, ['g1', 'c']);

    const svg = await selectionToSvgString(scene, ['g1']);
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
      data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: solid('#ff0000') } },
    },
  }, ['a']);
  // A payload with a field the SVG mapping drops (label) — surviving the
  // text/plain round-trip is the point of the metadata embed.
  const payload = () => buildWeaselClipboardText([
    { id: 'a', parent: null, pose: { x: 0, y: 0, width: 10, height: 10 }, data: { fill: { paint: solid('#ff0000') }, label: 'my label' } },
  ]);

  it('embeds the weasel payload extractably, byte-equal to the JSON flavor text', async () => {
    const svg = await selectionToClipboardSvgString(scene(), ['a'], payload());
    expect(extractWeaselClipboardFromSvg(svg)).toBe(payload());
  });

  it('external parse is unaffected: parseSvg succeeds and renders the same shapes', async () => {
    const plain = parseSvg(await selectionToSvgString(scene(), ['a']));
    const withMeta = parseSvg(await selectionToClipboardSvgString(scene(), ['a'], payload()));
    expect(withMeta.warnings).toEqual(plain.warnings);
    expect(withMeta.nodes).toEqual(plain.nodes);
    expect(withMeta.nodes).toHaveLength(1);
    expect(withMeta.viewBox).toEqual(plain.viewBox);
  });
});

describe('clipboardSnapshotRootIds', () => {
  it('returns the selected roots when the selection is leaves-only', async () => {
    const items = [
      { id: 'a', parent: null },
      { id: 'b', parent: null },
    ];
    expect(clipboardSnapshotRootIds(items)).toEqual(['a', 'b']);
  });

  it('excludes descendants a copied container flattens alongside it', async () => {
    // Mirrors sceneAdapter.snapshotSelection's shape for a copied group:
    // the container plus its full subtree, parents-before-children.
    const items = [
      { id: 'g1', parent: null },
      { id: 'a', parent: 'g1' },
      { id: 'b', parent: 'g1' },
    ];
    expect(clipboardSnapshotRootIds(items)).toEqual(['g1']);
  });

  it('treats an item whose parent is outside the snapshot as its own root', async () => {
    // e.g. a selected child of an unselected container — snapshotSelection
    // still only captures the selected node itself.
    const items = [{ id: 'a', parent: 'not-in-snapshot' }];
    expect(clipboardSnapshotRootIds(items)).toEqual(['a']);
  });

  it('handles multiple independent copied groups', async () => {
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
          fill: { paint: {
            kind: 'linear-gradient',
            from: { x: 0, y: 0.5 },
            to: { x: 1, y: 0.5 },
            stops: STOPS,
            units: 'bounds',
          } },
        },
      },
    }, ['a']);
  }

  it('resolves box-relative coordinates against the pose, not into a corner', async () => {
    const svg = await selectionToSvgString(gradientScene(), ['a']);
    const parsed = parseSvg(svg);
    const n = parsed.nodes[0];
    if (n.kind !== 'path') throw new Error('expected path');
    if (n.fill.kind !== 'gradient') throw new Error('expected a gradient fill');
    const paint = n.fill.paint as { kind: string; from: { x: number; y: number }; to: { x: number; y: number } };
    expect(paint.kind).toBe('linear-gradient');
    // Spans the node's own box in page coordinates — a `0..1` emission
    // would have been a 1px smear at the origin.
    expect(paint.from).toEqual({ x: 100, y: 100 });
    expect(paint.to).toEqual({ x: 300, y: 100 });
  });

  it('resolves a text node\'s box-relative gradient against its pose too', async () => {
    const scene = fakeScene({
      t: {
        kind: 'leaf',
        pose: { x: 100, y: 50, width: 200, height: 100 },
        data: {
          text: 'Hi',
          fill: { paint: {
            kind: 'linear-gradient', from: { x: 0, y: 0.5 }, to: { x: 1, y: 0.5 }, stops: STOPS, units: 'bounds',
          } },
          runs: [{
            text: 'Hi',
            fill: { paint: {
              kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: 0, y: 1 }, stops: STOPS, units: 'bounds',
            } },
          }],
        },
      },
    }, ['t']);
    const n = parseSvg(await selectionToSvgString(scene, ['t'])).nodes[0];
    if (n.kind !== 'text') throw new Error('expected text');
    const fill = n.fill?.paint as { from: { x: number; y: number }; to: { x: number; y: number } };
    expect(fill.from).toEqual({ x: 100, y: 100 });
    expect(fill.to).toEqual({ x: 300, y: 100 });
    const run = n.runs![0].fill?.paint as { from: { x: number; y: number }; to: { x: number; y: number } };
    expect(run.from).toEqual({ x: 100, y: 50 });
    expect(run.to).toEqual({ x: 100, y: 150 });
  });

  it('emits the stops in order', async () => {
    const svg = await selectionToSvgString(gradientScene(), ['a']);
    const parsed = parseSvg(svg);
    const n = parsed.nodes[0];
    if (n.kind !== 'path' || n.fill.kind !== 'gradient') throw new Error('expected a gradient fill');
    const paint = n.fill.paint as { stops: { offset: number; color: string }[] };
    expect(paint.stops.map((s) => s.offset)).toEqual([0, 1]);
    expect(paint.stops.map((s) => s.color.slice(0, 7))).toEqual(['#ff0000', '#0000ff']);
  });

  it('re-imports as a box-relative gradient, so it still tracks its node', async () => {
    const svg = await selectionToSvgString(gradientScene(), ['a']);
    let n = 0;
    const drafts = svgNodesToSceneDrafts(parseSvg(svg).nodes, () => `n${n++}`);
    const leaf = drafts.find((d) => d.kind === 'leaf');
    if (leaf?.kind !== 'leaf') throw new Error('expected a leaf draft');
    if (!('path' in leaf.obj)) throw new Error('expected a path draft');
    const fill = leaf.obj.fill?.paint as {
      kind: string; units: string; from: { x: number; y: number }; to: { x: number; y: number };
    };
    expect(fill.kind).toBe('linear-gradient');
    expect(fill.units).toBe('bounds');
    expect(fill.from.x).toBeCloseTo(0);
    expect(fill.from.y).toBeCloseTo(0.5);
    expect(fill.to.x).toBeCloseTo(1);
    expect(fill.to.y).toBeCloseTo(0.5);
  });
});

describe('what the SVG cannot carry', () => {
  it('reports an inner-aligned stroke through onWarn instead of dropping it silently', async () => {
    const scene = fakeScene({
      r: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: {
          path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
          fill: { paint: solid('#ff0000') },
          stroke: { paint: solid('#000000'), width: 2, align: 'inner' },
        },
      },
    }, ['r']);
    const warnings: string[] = [];
    await sceneToSvgString(scene, {
      filename: 'a', paperSize: 'letter' as never, paperWidth: 100, paperHeight: 100,
      backgroundColor: '#ffffff', onWarn: (w) => warnings.push(w),
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('inner');
  });
});

describe('image export', () => {
  it('writes a kit:image leaf as <image>', async () => {
    const src = 'data:image/png;base64,iVBORw0KGgo=';
    const scene = fakeScene({
      im: {
        kind: 'leaf',
        pose: { x: 3, y: 4, width: 30, height: 20 },
        data: { image: { src, flipX: true } },
      },
    }, ['im']);

    const n = parseSvg(await selectionToSvgString(scene, ['im'])).nodes[0];
    expect(n).toMatchObject({ kind: 'image', href: src, x: 3, y: 4, width: 30, height: 20, flipX: true });
  });
});

describe('derived poses', () => {
  it('lowers a leaf at the pose it derives, not the one it stores', async () => {
    const scene = fakeScene({
      src: { kind: 'leaf', pose: { x: 0, y: 0, width: 1, height: 1 } },
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: solid('#ff0000') } },
        dependsOn: ['src'],
        derivePose: () => ({ x: 50, y: 60, width: 10, height: 10 }),
      },
    }, ['a']);
    const [a] = parseSvg(await selectionToSvgString(scene, ['a'])).nodes;
    if (a.kind !== 'path') throw new Error('expected path');
    expect(boundsOfPath(a.path)).toMatchObject({ x: 50, y: 60 });
  });
});

describe('pose composition', () => {
  // A container whose pose is a frame: turned a quarter about its center
  // (20, 10). The child's local box centers on (5, 5) in the container's
  // unrotated frame, which the turn carries to (25, -5).
  function framedScene(composition: unknown = RIGID_POSE_COMPOSITION) {
    return fakeScene({
      g: {
        kind: 'container',
        pose: { x: 0, y: 0, width: 40, height: 20, rotation: Math.PI / 2 },
        children: ['a'],
      },
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: solid('#ff0000') } },
      },
    }, ['g'], composition);
  }

  function leafOf(svg: string) {
    const [g] = parseSvg(svg).nodes;
    if (g.kind !== 'group') throw new Error('expected group');
    const [a] = g.children;
    if (a.kind !== 'path') throw new Error('expected path');
    return a;
  }

  it('lowers a leaf at its world pose under a composing strategy', async () => {
    const svg = await sceneToSvgString(framedScene(), {
      filename: 'f', paperSize: 'letter', paperWidth: 100, paperHeight: 100,
      backgroundColor: '#ffffff',
    });
    const a = leafOf(svg);
    const b = boundsOfPath(a.path);
    expect(a.rotation).toBeCloseTo(Math.PI / 2);
    expect(b.x + b.width / 2).toBeCloseTo(25);
    expect(b.y + b.height / 2).toBeCloseTo(-5);
  });

  it('fits a selection to its world bounds under a composing strategy', async () => {
    const parsed = parseSvg(await selectionToSvgString(framedScene(), ['a']));
    expect(parsed.viewBox!.x).toBeCloseTo(20);
    expect(parsed.viewBox!.y).toBeCloseTo(-10);
    expect(parsed.viewBox!.width).toBeCloseTo(10);
    expect(parsed.viewBox!.height).toBeCloseTo(10);
  });

  it('bakes stored poses under the identity composition', async () => {
    const bare = await selectionToSvgString(framedScene(IDENTITY_POSE_COMPOSITION), ['g']);
    expect(leafOf(bare).rotation).toBeUndefined();
  });
});

describe('a paint kind that loads on demand', () => {
  const disposers: (() => void)[] = [];
  afterEach(() => {
    for (const d of disposers.splice(0)) d();
    vi.restoreAllMocks();
  });

  /** A scene holding one rect filled by `id`, a kind declared with a loader
   *  and not loaded yet. A loaded kind stays registered, so each test takes
   *  its own id. */
  function lazyScene(id: string, load: () => Promise<never> | undefined = () => undefined) {
    disposers.push(registerPaintKindLoader(id, async () => load() ?? {
      id, label: id, seed: () => asPaint({ kind: id }), colorOf: () => '#123456',
      toSvg: (defId: string) => `<linearGradient id="${defId}" data-kind="${id}"/>`,
    }));
    return fakeScene({
      a: {
        kind: 'leaf',
        pose: { x: 0, y: 0, width: 10, height: 10 },
        data: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, fill: { paint: asPaint({ kind: id }) } },
      },
    }, ['a']);
  }

  const PAGE = { filename: 'f', paperSize: 'letter', paperWidth: 100, paperHeight: 100, backgroundColor: '#ffffff' } as const;

  it('writes its def in a page export', async () => {
    const warnings: string[] = [];
    const svg = await sceneToSvgString(lazyScene('test-lazy-page'), { ...PAGE, onWarn: (w) => warnings.push(w) });
    expect(svg).toContain('data-kind="test-lazy-page"');
    expect(warnings).toEqual([]);
  });

  it('writes its def in a selection export', async () => {
    expect(await selectionToSvgString(lazyScene('test-lazy-selection'), ['a']))
      .toContain('data-kind="test-lazy-selection"');
  });

  it('writes its def in the clipboard flavor', async () => {
    expect(await selectionToClipboardSvgString(lazyScene('test-lazy-clipboard'), ['a'], '{}'))
      .toContain('data-kind="test-lazy-clipboard"');
  });

  it('still exports, and says why the def is missing, when the kind fails to load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const scene = lazyScene('test-lazy-broken', () => Promise.reject(new Error('offline')));
    const warnings: string[] = [];
    const svg = await sceneToSvgString(scene, { ...PAGE, onWarn: (w) => warnings.push(w) });
    expect(svg).toContain('<svg');
    expect(warnings.join(' ')).toMatch(/offline/);
  });
});

describe('text export with the canvas layout', () => {
  const realFetch = global.fetch;
  const realBitmap = global.createImageBitmap;

  beforeEach(async () => {
    _resetFontRegistryForTests();
    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockImplementation((url: string) => url.endsWith('.json')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
      : Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      })) as typeof fetch;
    global.createImageBitmap = vi.fn().mockResolvedValue({
      width: 512, height: 512, close: vi.fn(),
    } as unknown as ImageBitmap);
    await registerFont('inter', {}, '/f/inter.json', '/f/inter.png');
  });

  afterEach(() => {
    _resetFontRegistryForTests();
    global.fetch = realFetch;
    global.createImageBitmap = realBitmap;
  });

  // FIXTURE_FONT at 32: 'AB AB' is 96 wide, so a third word wraps at 100.
  it('writes a wrapped node as the lines the canvas draws, and reads it back whole', async () => {
    const scene = fakeScene({
      t: {
        kind: 'leaf',
        pose: { x: 5, y: 6, width: 100, height: 100 },
        data: { text: 'AB AB AB', style: { fontFamily: 'inter', fontSize: 32, wrap: true } },
      },
    }, ['t']);
    const svg = await selectionToSvgString(scene, ['t']);
    const lines = [...svg.matchAll(/<tspan x="([\d.]+)" y="([\d.]+)" data-weasel-lines="0">([^<]*)</g)];
    expect(lines.map((m) => m[3])).toEqual(['AB AB ', 'AB']);
    expect(lines.map((m) => Number(m[1]))).toEqual([5, 5]);
    expect(Number(lines[1][2])).toBeGreaterThan(Number(lines[0][2]));
    const n = parseSvg(svg).nodes[0];
    if (n.kind !== 'text') throw new Error('expected text');
    expect(n.text).toBe('AB AB AB');
    expect(n.style?.wrap).toBe(true);
  });
});
