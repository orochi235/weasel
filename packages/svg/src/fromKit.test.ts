import { describe, it, expect } from 'vitest';
import {
  createScene, DEFAULT_SHAPE_FILL, getMarker, pathFromD, registerMarker, solid,
  type FillStyle, type Path, type PolygonPath, type Stroke,
} from '@weasel-js/core';
import {
  svgImageFromKit, svgLeafFromKit, svgNodesFromKit, svgPaintFromKit, svgStrokeFromKit, type SvgKitTree,
} from './fromKit';
import { strokeDataFromSvg, svgNodesToKitDrafts } from './unpack';
import { parseSvg } from './parse';
import { serializeSvg } from './serialize';
import type { SvgGroupNode, SvgPathNode, SvgTextNode } from './types';

const BOX = { x: 10, y: 20, width: 100, height: 50 };
const rect: Path = { kind: 'rect', x: 10, y: 20, width: 100, height: 50 };
const linear: FillStyle = {
  fill: 'linear-gradient', units: 'bounds',
  from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
  stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
};

describe('svgPaintFromKit', () => {
  it('writes null as none and a solid as a color carrying its opacity', () => {
    expect(svgPaintFromKit(null, BOX)).toEqual({ kind: 'none' });
    expect(svgPaintFromKit({ ...solid('#123456'), opacity: 0.5 }, BOX))
      .toEqual({ kind: 'solid', color: '#123456', opacity: 0.5 });
  });

  it('resolves a box-relative gradient into the box it is painted in', () => {
    const p = svgPaintFromKit(linear, BOX);
    if (p.kind !== 'gradient') throw new Error('expected gradient');
    expect(p.paint).toMatchObject({ from: { x: 10, y: 20 }, to: { x: 110, y: 20 } });
  });
});

describe('svgStrokeFromKit', () => {
  it('carries every structural field, and a marker with its size', () => {
    const stroke: Stroke = {
      paint: { ...solid('#000000'), opacity: 0.25 }, width: 3, cap: 'round', join: 'bevel',
      dash: [4, 2], miterLimit: 6, align: 'inner',
      markerStart: 'dot', markerEnd: { key: 'arrow', size: 2 },
    };
    expect(svgStrokeFromKit(stroke, BOX)).toEqual({
      paint: { kind: 'solid', color: '#000000', opacity: 0.25 }, width: 3, opacity: 0.25,
      cap: 'round', join: 'bevel', dash: [4, 2], miterLimit: 6, align: 'inner',
      markerStart: 'dot', markerEnd: { key: 'arrow', size: 2 },
    });
  });

  it('round-trips a marker size through export and import', () => {
    const line: Path = {
      kind: 'polygon', commands: new Uint8Array([0, 1]), coords: new Float32Array([0, 0, 50, 0]), fillRule: 'nonzero',
    };
    const stroke: Stroke = {
      paint: solid('#000000'), width: 2,
      markerStart: { key: 'arrow', size: { px: 12 } }, markerMid: 'arrow', markerEnd: { key: 'arrow', size: 3 },
    };
    const box = { x: 0, y: 0, width: 50, height: 0 };
    const out = serializeSvg([{ kind: 'path', path: line, fill: { kind: 'none' }, stroke: svgStrokeFromKit(stroke, box)! }]);
    const parsed = parseSvg(out);
    expect(parsed.warnings).toEqual([]);
    const back = strokeDataFromSvg((parsed.nodes[0] as SvgPathNode).stroke, box)!;
    expect(back.markerStart).toEqual({ key: 'arrow', size: { px: 12 } });
    expect(back.markerMid).toBe('arrow');
    expect(back.markerEnd).toEqual({ key: 'arrow', size: 3 });
  });

  it('keeps a sized reference to a marker the importing session never registered', () => {
    const tick = pathFromD('M0 0 L-2 1 L-2 -1 Z') as PolygonPath;
    const dispose = registerMarker({
      id: 'app:tick', fill: 'line',
      path: ({ size }) => ({ ...tick, coords: tick.coords.map((v) => v * size) }),
    });
    const line: Path = {
      kind: 'polygon', commands: new Uint8Array([0, 1]), coords: new Float32Array([0, 0, 50, 0]), fillRule: 'nonzero',
    };
    const stroke: Stroke = {
      paint: solid('#000000'), width: 2,
      markerStart: { key: 'app:tick', size: { px: 12 } }, markerEnd: { key: 'app:tick', size: 3 },
    };
    const box = { x: 0, y: 0, width: 50, height: 0 };
    const out = serializeSvg([{ kind: 'path', path: line, fill: { kind: 'none' }, stroke: svgStrokeFromKit(stroke, box)! }]);
    dispose();
    expect(getMarker('app:tick')).toBeUndefined();

    const parsed = parseSvg(out);
    expect(parsed.warnings).toEqual([]);
    const back = strokeDataFromSvg((parsed.nodes[0] as SvgPathNode).stroke, box)!;
    expect(back.markerStart).toEqual({ key: 'app:tick', size: { px: 12 } });
    expect(back.markerEnd).toEqual({ key: 'app:tick', size: 3 });
    expect(parsed.markers?.map((m) => m.id)).toEqual(['app:tick']);
    const unit = parsed.markers![0].path({ size: 1, stroke: {} }) as PolygonPath;
    expect(Array.from(unit.coords)).toEqual(Array.from(tick.coords).map((v) => expect.closeTo(v, 4)));
  });

  it('writes no stroke for one with no paint or no width', () => {
    expect(svgStrokeFromKit(undefined, BOX)).toBeUndefined();
    expect(svgStrokeFromKit(null, BOX)).toBeUndefined();
    expect(svgStrokeFromKit({ width: 2 }, BOX)).toBeUndefined();
    expect(svgStrokeFromKit({ paint: solid('#000'), width: 0 }, BOX)).toBeUndefined();
  });

  it('defaults an unset width to 1', () => {
    expect(svgStrokeFromKit({ paint: solid('#000') }, BOX)?.width).toBe(1);
  });
});

describe('svgLeafFromKit', () => {
  it('draws an absent path fill the way kit:path does', () => {
    const bare = svgLeafFromKit({ path: rect }, BOX) as SvgPathNode;
    expect(bare.fill).toEqual(svgPaintFromKit(DEFAULT_SHAPE_FILL, BOX));
    const stroked = svgLeafFromKit({ path: rect, stroke: { paint: solid('#000'), width: 1 } }, BOX) as SvgPathNode;
    expect(stroked.fill).toEqual({ kind: 'none' });
  });

  it('bakes the pose into the path and carries rotation', () => {
    const node = svgLeafFromKit(
      { path: rect, fill: solid('#ff0000') },
      { x: 0, y: 0, width: 20, height: 10, rotation: 0.5 },
    ) as SvgPathNode;
    expect(node.path).toEqual({ kind: 'rect', x: 0, y: 0, width: 20, height: 10 });
    expect(node.rotation).toBe(0.5);
  });

  it('writes a text leaf with its paint in the pose frame', () => {
    const node = svgLeafFromKit({
      text: 'hi', style: { fontSize: 20 }, verticalAlign: 'center',
      fill: linear, runs: [{ text: 'hi', fill: linear }],
    }, BOX) as SvgTextNode;
    expect(node).toMatchObject({
      kind: 'text', text: 'hi', style: { fontSize: 20 }, verticalAlign: 'center', ...BOX,
    });
    expect(node.fill).toMatchObject({ from: { x: 10, y: 20 }, units: 'local' });
    expect(node.runs?.[0].fill).toMatchObject({ from: { x: 10, y: 20 }, units: 'local' });
  });

  it('writes an image leaf, and null for data no built-in painter draws', () => {
    expect(svgLeafFromKit({ image: { src: 'a.png' } }, BOX)).toMatchObject({ kind: 'image', href: 'a.png' });
    expect(svgLeafFromKit({}, BOX)).toBeNull();
  });
});

describe('svgNodesFromKit', () => {
  const tree: SvgKitTree<string> = {
    roots: ['g', 'c'],
    childrenOf: (id) => (id === 'g' ? ['a', 'b'] : []),
    get: (id) => {
      if (id === 'g') return { kind: 'container', data: {}, pose: BOX };
      const x = id === 'a' ? 0 : id === 'b' ? 20 : 40;
      return { kind: 'leaf', data: { path: { kind: 'rect', x, y: 0, width: 10, height: 10 } }, pose: { x, y: 0, width: 10, height: 10 } };
    },
  };

  it('writes containers as groups and leaves in z-order', () => {
    const nodes = svgNodesFromKit(tree);
    expect(nodes.map((n) => n.kind)).toEqual(['group', 'path']);
    expect((nodes[0] as SvgGroupNode).children).toHaveLength(2);
  });

  it('walks only the roots it is given, and skips what include rejects', () => {
    expect(svgNodesFromKit(tree, { roots: ['c'] })).toHaveLength(1);
    const g = svgNodesFromKit(tree, { include: (id) => id !== 'a' })[0] as SvgGroupNode;
    expect(g.children).toHaveLength(1);
  });

  it('lets a leaf hook replace the lowering and a group hook decorate it', () => {
    const nodes = svgNodesFromKit(tree, {
      leaf: (id, node) => (id === 'c' ? null : svgLeafFromKit(node.data as never, node.pose)),
      group: (id, g) => ({ ...g, meta: { x: { attrs: { id } } } }),
    });
    expect(nodes).toHaveLength(1);
    expect((nodes[0] as SvgGroupNode).meta).toEqual({ x: { attrs: { id: 'g' } } });
  });

  it('round-trips a document through a scene back to the same SVG nodes', () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 320">
      <rect x="30" y="40" width="140" height="90" fill="#7fb069" fill-opacity="0.5"/>
      <g><circle cx="290" cy="90" r="55" fill="#d4a574" stroke="#1a130d" stroke-width="4"/>
      <ellipse cx="300" cy="240" rx="80" ry="40" fill="none" stroke="#7ab8d4"
        stroke-width="6" stroke-dasharray="14 8" stroke-linecap="round"/></g>
    </svg>`;
    const parsed = parseSvg(source);
    let n = 0;
    const drafts = svgNodesToKitDrafts(parsed, () => `n${n++}`);
    const scene = createScene<Record<string, unknown>, 'default'>({ systemLayers: [{ id: 'default' }] });
    scene.loadState({
      version: 1,
      systemLayers: [{ id: 'default' }],
      nodes: drafts.map((d) => ({
        id: d.id, kind: d.kind, layer: 'default', pose: d.pose,
        data: d.kind === 'leaf' ? d.data : {},
        ...(d.parentId ? { parent: d.parentId } : {}),
      })),
    } as never);
    const back = parseSvg(serializeSvg(svgNodesFromKit(scene))).nodes;
    expect(back).toEqual(parsed.nodes);
  });
});

describe('svgImageFromKit', () => {
  it('writes a kit:image leaf back as the SvgImageNode it was read from', () => {
    const original = parseSvg(serializeSvg([{
      kind: 'image', href: 'a.png', x: 5, y: 6, width: 40, height: 30,
      source: { x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, flipX: true,
      opacity: 0.5, rotation: Math.PI / 4,
    }])).nodes;
    const [d] = svgNodesToKitDrafts(original, () => 'i');
    if (d.kind !== 'leaf') throw new Error('expected leaf');
    const back = svgImageFromKit(
      d.data.image as Parameters<typeof svgImageFromKit>[0], d.pose,
    );
    expect(back).toEqual(original[0]);
    expect(parseSvg(serializeSvg([back])).nodes).toEqual(original);
  });

  it('writes a plain image without source, flips, opacity or rotation', () => {
    expect(svgImageFromKit({ src: 'a.png' }, { x: 1, y: 2, width: 3, height: 4 })).toEqual({
      kind: 'image', href: 'a.png', x: 1, y: 2, width: 3, height: 4,
    });
  });
});
