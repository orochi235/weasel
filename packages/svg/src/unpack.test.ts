import { describe, it, expect, vi } from 'vitest';
import type { SvgNode } from './types';
import { UNBOUNDED_TEXT_WIDTH } from './types';
import { svgNodesToKitDrafts, unpackSvgFiles } from './unpack';
import type { IngestCtx, Op } from '@weasel-js/core';

const rectNode = (x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}): SvgNode => ({
  kind: 'path',
  path: { kind: 'rect', x, y, width: w, height: h },
  fill: { kind: 'solid', color: '#ff0000' },
  ...extra,
} as SvgNode);

function seq(): () => string {
  let n = 0;
  return () => `d${++n}`;
}

type InsertedNode = {
  id: string; kind: string; layer: string;
  pose: { x: number; y: number; width: number; height: number; rotation?: number };
  data: Record<string, unknown>; parent: string | null;
};

function ctx(overrides: Partial<IngestCtx> = {}) {
  const batches: { ops: InsertedNode[]; label?: string }[] = [];
  const c = {
    point: null,
    viewportWorldRect: () => ({ x: 0, y: 0, width: 800, height: 600 }),
    insert: { commit: vi.fn() },
    applyOps: (ops: Op[], label?: string) => {
      batches.push({
        ops: ops.map((op) => (op.args as { node: InsertedNode }).node),
        label,
      });
    },
    scene: { layers: [{ id: 'main' }] } as never,
    selection: {} as never,
    deps: {},
    ...overrides,
  } as unknown as IngestCtx;
  return { c, batches };
}

describe('svgNodesToKitDrafts', () => {
  it('maps a path node to a leaf draft with kit-native {path, fill} data', () => {
    const drafts = svgNodesToKitDrafts([rectNode(10, 20, 30, 40)], seq());
    expect(drafts).toHaveLength(1);
    const d = drafts[0];
    expect(d.kind).toBe('leaf');
    if (d.kind !== 'leaf') return;
    expect(d.parentId).toBeNull();
    expect(d.pose).toEqual({ x: 10, y: 20, width: 30, height: 40 });
    expect(d.data.path).toEqual({ kind: 'rect', x: 10, y: 20, width: 30, height: 40 });
    expect(d.data.fill).toEqual({ color: '#ff0000' });
    expect(d.data.stroke).toBeUndefined();
  });

  it("maps SVG's fill=none to an explicit null fill, and a stroke to a Stroke", () => {
    const drafts = svgNodesToKitDrafts([rectNode(0, 0, 10, 10, {
      fill: { kind: 'none' },
      stroke: { paint: { kind: 'solid', color: '#00ff00' }, width: 3 },
    })], seq());
    const d = drafts[0];
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    // `null`, not absent: absent takes the painter's default fill, which is
    // not what `fill="none"` asked for.
    expect(d.data.fill).toBeNull();
    expect(d.data.stroke).toEqual({ paint: { color: '#00ff00' }, width: 3 });
  });

  it('carries element rotation onto the pose', () => {
    const drafts = svgNodesToKitDrafts([rectNode(0, 0, 10, 10, { rotation: Math.PI / 4 })], seq());
    const d = drafts[0];
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    expect(d.pose.rotation).toBeCloseTo(Math.PI / 4);
  });

  it('maps a text node to a leaf with {text, style} data', () => {
    const drafts = svgNodesToKitDrafts([{
      kind: 'text', x: 5, y: 6, width: 100, height: 20,
      text: 'hello', style: { fontSize: 14 },
    } as SvgNode], seq());
    const d = drafts[0];
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    expect(d.data.text).toBe('hello');
    expect(d.data.style).toEqual({ fontSize: 14 });
    expect(d.pose).toEqual({ x: 5, y: 6, width: 100, height: 20 });
  });

  it("maps an image node to the kit:image painter's {image:{src}} data", () => {
    const drafts = svgNodesToKitDrafts([{
      kind: 'image', href: 'data:image/png;base64,AA==',
      x: 5, y: 6, width: 40, height: 30, opacity: 0.5, rotation: Math.PI / 2,
    } as SvgNode], seq());
    const d = drafts[0];
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    expect(d.data.image).toEqual({ src: 'data:image/png;base64,AA==', opacity: 0.5 });
    expect(d.pose).toEqual({ x: 5, y: 6, width: 40, height: 30, rotation: Math.PI / 2 });
  });

  it("estimates a box for external text's unbounded-width sentinel", () => {
    const drafts = svgNodesToKitDrafts([{
      kind: 'text', x: 0, y: 0, width: UNBOUNDED_TEXT_WIDTH, height: 20,
      text: 'hello', style: { fontSize: 10 },
    } as SvgNode], seq());
    const d = drafts[0];
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    // 5 glyphs at 10px, 0.6 em average advance. The sentinel itself would
    // swamp the union AABB every fit-clamp is measured against.
    expect(d.pose.width).toBeCloseTo(30);
  });

  it('groups become container drafts (parent-before-child, union-AABB pose)', () => {
    const drafts = svgNodesToKitDrafts([{
      kind: 'group',
      children: [rectNode(0, 0, 10, 10), rectNode(20, 20, 10, 10)],
    } as SvgNode], seq());
    expect(drafts).toHaveLength(3);
    const [g, a, b] = drafts;
    expect(g.kind).toBe('container');
    expect(g.pose).toEqual({ x: 0, y: 0, width: 30, height: 30 });
    expect(a.parentId).toBe(g.id);
    expect(b.parentId).toBe(g.id);
    // Parent-before-child ordering: the container precedes its members.
    expect(drafts.indexOf(g)).toBeLessThan(drafts.indexOf(a));
  });

  it('carries a bounds-relative gradient fill through as a FillStyle', () => {
    const paint = {
      fill: 'linear-gradient', units: 'bounds',
      from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
    };
    const drafts = svgNodesToKitDrafts([rectNode(0, 0, 10, 10, {
      fill: { kind: 'gradient', paint },
    })], seq());
    const d = drafts[0];
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    expect(d.data.fill).toEqual(paint);
  });

  it('normalizes a userSpaceOnUse gradient against the leaf box', () => {
    // Page-space geometry doesn't survive the fit-clamp and drop-point
    // placement that move the node out from under it.
    const drafts = svgNodesToKitDrafts([rectNode(20, 40, 10, 20, {
      fill: {
        kind: 'gradient',
        paint: {
          fill: 'linear-gradient', units: 'world',
          from: { x: 20, y: 40 }, to: { x: 30, y: 40 },
          stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
        },
      },
    })], seq());
    const d = drafts[0];
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    expect(d.data.fill).toMatchObject({
      units: 'bounds', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
    });
  });

  it('keeps a gradient STROKE as a paint', () => {
    const drafts = svgNodesToKitDrafts([rectNode(0, 0, 10, 10, {
      stroke: {
        paint: {
          kind: 'gradient',
          paint: {
            fill: 'linear-gradient',
            units: 'bounds',
            from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
            stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
          },
        },
        width: 2,
      },
    })], seq());
    const d = drafts[0];
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    expect(d.data.stroke).toMatchObject({
      paint: { fill: 'linear-gradient' },
      width: 2,
    });
  });

  it('keeps dash, cap, join and miter limit', () => {
    const drafts = svgNodesToKitDrafts([rectNode(0, 0, 10, 10, {
      stroke: {
        paint: { kind: 'solid', color: '#00ff00' },
        width: 3, cap: 'round', join: 'bevel', dash: [4, 2], miterLimit: 8,
      },
    })], seq());
    const d = drafts[0];
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    expect(d.data.stroke).toEqual({
      paint: { color: '#00ff00' },
      width: 3, cap: 'round', join: 'bevel', dash: [4, 2], miterLimit: 8,
    });
  });

  it('carries stroke-opacity onto the paint', () => {
    const drafts = svgNodesToKitDrafts([rectNode(0, 0, 10, 10, {
      stroke: { paint: { kind: 'solid', color: '#00ff00' }, width: 1, opacity: 0.5 },
    })], seq());
    const d = drafts[0];
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    expect(d.data.stroke).toEqual({ paint: { color: '#00ff00', opacity: 0.5 }, width: 1 });
  });

  it('rebases a userSpaceOnUse gradient stroke onto the leaf box, as it does a fill', () => {
    // Otherwise the fit-clamp and drop placement move the geometry out from
    // under a paint still described in the source document's coordinates.
    const drafts = svgNodesToKitDrafts([rectNode(20, 40, 10, 10, {
      stroke: {
        paint: {
          kind: 'gradient',
          paint: {
            fill: 'linear-gradient',
            units: 'world',
            from: { x: 20, y: 40 }, to: { x: 30, y: 40 },
            stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
          },
        },
        width: 2,
      },
    })], seq());
    const d = drafts[0];
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    expect((d.data.stroke as { paint: unknown }).paint).toMatchObject({
      units: 'bounds', from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
    });
  });
});

describe('unpackSvgFiles', () => {
  const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="10" y="10" width="30" height="20" fill="#ff0000"/>
    <g><rect x="60" y="60" width="20" height="20" fill="#00ff00"/></g>
  </svg>`;

  const asFile = (text: string, name = 'art.svg') =>
    new File([text], name, { type: 'image/svg+xml' });

  it('inserts one undoable batch: multi-root files wrap in a single container', async () => {
    const { c, batches } = ctx({ point: { x: 400, y: 300 } });
    await unpackSvgFiles([asFile(SVG)], c);
    expect(batches).toHaveLength(1);
    const nodes = batches[0].ops;
    // wrapper + rect leaf + <g> container + inner rect leaf
    expect(nodes).toHaveLength(4);
    const wrapper = nodes[0];
    expect(wrapper.kind).toBe('container');
    expect(wrapper.parent).toBeNull();
    for (const n of nodes.slice(1)) {
      // Every non-wrapper node hangs off the wrapper or the inner <g>.
      expect(n.parent).not.toBeNull();
    }
    expect(nodes.every((n) => n.layer === 'main')).toBe(true);
  });

  it('centers the dropped subtree on the point (translate-only when it fits)', async () => {
    const { c, batches } = ctx({ point: { x: 400, y: 300 } });
    await unpackSvgFiles([asFile(SVG)], c);
    const wrapper = batches[0].ops[0];
    // Source union: (10,10)-(80,80) → 70×70 fits in 90% of 800×600 (scale 1).
    expect(wrapper.pose.width).toBeCloseTo(70);
    expect(wrapper.pose.height).toBeCloseTo(70);
    expect(wrapper.pose.x + wrapper.pose.width / 2).toBeCloseTo(400);
    expect(wrapper.pose.y + wrapper.pose.height / 2).toBeCloseTo(300);
  });

  it('a single-root svg inserts without a synthesized wrapper', async () => {
    const oneRoot = `<svg xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="50" height="50" fill="#0000ff"/>
    </svg>`;
    const { c, batches } = ctx({ point: { x: 100, y: 100 } });
    await unpackSvgFiles([asFile(oneRoot)], c);
    const nodes = batches[0].ops;
    expect(nodes).toHaveLength(1);
    expect(nodes[0].kind).toBe('leaf');
    expect(nodes[0].parent).toBeNull();
    expect(nodes[0].pose.x + nodes[0].pose.width / 2).toBeCloseTo(100);
  });

  it('fit-clamps an oversized svg to 90% of the viewport, preserving aspect', async () => {
    const big = `<svg xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="4000" height="1000" fill="#000"/>
    </svg>`;
    const { c, batches } = ctx();
    await unpackSvgFiles([asFile(big)], c);
    const leaf = batches[0].ops[0];
    expect(leaf.pose.width).toBeCloseTo(720);   // 800 * 0.9
    expect(leaf.pose.height).toBeCloseTo(180);  // aspect preserved
    // Centered on the viewport when point is null.
    expect(leaf.pose.x + leaf.pose.width / 2).toBeCloseTo(400);
    expect(leaf.pose.y + leaf.pose.height / 2).toBeCloseTo(300);
  });

  it('fit-clamp scales text fontSize alongside the poses', async () => {
    const big = `<svg xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="800" font-size="40" fill="#000">hello</text>
      <rect x="0" y="0" width="4000" height="1000" fill="#000"/>
    </svg>`;
    const { c, batches } = ctx();
    await unpackSvgFiles([asFile(big)], c);
    const text = batches[0].ops.find((n) => typeof n.data.text === 'string')!;
    // 4000-wide union clamps to 720 (800 * 0.9), i.e. scale 0.18.
    expect((text.data.style as { fontSize: number }).fontSize).toBeCloseTo(40 * 0.18);
  });

  it('unscaled imports leave text data untouched', async () => {
    const small = `<svg xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="20" font-size="40" fill="#000">hello</text>
    </svg>`;
    const { c, batches } = ctx();
    await unpackSvgFiles([asFile(small)], c);
    const text = batches[0].ops[0];
    expect((text.data.style as { fontSize: number }).fontSize).toBeCloseTo(40);
  });

  it('an unparseable file warns and produces no ops; others proceed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { c, batches } = ctx({ point: { x: 0, y: 0 } });
    await unpackSvgFiles([asFile('this is not svg', 'junk.svg'), asFile(SVG)], c);
    expect(batches).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
  });
});
