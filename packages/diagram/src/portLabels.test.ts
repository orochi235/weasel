import { describe, expect, it } from 'vitest';
import { bodyTrait, type BodySpec, type MeasureRowText } from './body';
import { buildBody } from './buildBody';
import { createScene, effectivePose, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from './edge';
import { diagramScene, type DiagramData, type DiagramSpec } from './fromData';
import { layered } from './layered';
import { planOf } from './layout';
import { footprintNode } from './footprint';
import { portLabelBox, PORT_LABEL_GAP } from './portLabels';
import { COMPASS, portSitesOf, portsOf } from './ports';
import type { Graph, GraphNode } from './graph';

const G = PORT_LABEL_GAP;
const SIZE = { width: 20, height: 10 };
/** 6 per glyph, 10 tall. */
const measure: MeasureRowText = (text) => ({ width: text.length * 6, height: 10 });

describe('portLabelBox', () => {
  it('sets a side port\'s label outside the face, above the wire', () => {
    expect(portLabelBox({ point: { x: 100, y: 50 }, normal: { x: 1, y: 0 } }, SIZE))
      .toEqual({ x: 100 + G, y: 50 - G / 2 - 10, width: 20, height: 10 });
    expect(portLabelBox({ point: { x: 0, y: 50 }, normal: { x: -1, y: 0 } }, SIZE))
      .toEqual({ x: -G - 20, y: 50 - G / 2 - 10, width: 20, height: 10 });
  });

  it('sets a top or bottom port\'s label outside the face, right of the wire', () => {
    expect(portLabelBox({ point: { x: 50, y: 100 }, normal: { x: 0, y: 1 } }, SIZE))
      .toEqual({ x: 50 + G / 2, y: 100 + G, width: 20, height: 10 });
    expect(portLabelBox({ point: { x: 50, y: 0 }, normal: { x: 0, y: -1 } }, SIZE))
      .toEqual({ x: 50 + G / 2, y: -G - 10, width: 20, height: 10 });
  });

  it('sets a corner port\'s label off the corner, and a port with no direction\'s above it', () => {
    const s = Math.SQRT1_2;
    expect(portLabelBox({ point: { x: 100, y: 100 }, normal: { x: s, y: s } }, SIZE))
      .toEqual({ x: 100 + G, y: 100 + G, width: 20, height: 10 });
    expect(portLabelBox({ point: { x: 50, y: 50 }, normal: null }, SIZE))
      .toEqual({ x: 40, y: 50 - G - 10, width: 20, height: 10 });
  });
});

describe('port labels on a built body', () => {
  const spec = (over: Partial<BodySpec> = {}): BodySpec =>
    ({ outline: 'rect', rows: [{ kind: 'label', text: 'op' }], ...over });
  const BOUNDS = { x: 0, y: 0, width: 100, height: 60 };

  it('puts portLabels on the compass ports they name', () => {
    const trait = bodyTrait(spec({ portLabels: { e: 'out' } }), BOUNDS, measure);
    expect(trait.ports!.find((p) => p.id === 'e')!.label).toBe('out');
    expect(trait.ports!.find((p) => p.id === 'w')!.label).toBeUndefined();
  });

  it('keeps a declared port\'s own label, and lets portLabels override it', () => {
    const ports = [{ id: 'a', at: COMPASS.n, label: 'mine' }, { id: 'b', at: COMPASS.s, label: 'mine' }];
    const trait = bodyTrait(spec({ ports, portLabels: { b: 'theirs' } }), BOUNDS, measure);
    expect(trait.ports!.map((p) => p.label)).toEqual(['mine', 'theirs']);
  });

  it('records how far the labels reach past the box as its margin', () => {
    const trait = bodyTrait(spec({ portLabels: { e: 'out', s: 'down' } }), BOUNDS, measure);
    expect(trait.margin).toEqual({ top: 0, right: G + 18, bottom: G + 10, left: 0 });
    expect(bodyTrait(spec(), BOUNDS, measure).margin).toBeUndefined();
  });

  it('emits one leaf per labeled perimeter port, at its label box', () => {
    const { specs } = buildBody(spec({ portLabels: { e: 'out' } }), BOUNDS, {
      layer: 'main',
      id: 'n',
      measure,
      body: () => ({}),
      row: () => null,
      portLabel: (text, box) => ({ text, side: box.side }),
    });
    const leaf = specs.find((s) => (s.data as { text?: string }).text === 'out')!;
    expect(leaf.data).toEqual({ text: 'out', side: 'outside' });
    expect(leaf.parent).toBe('n');
    expect(leaf.pickable).toBe(false);
    expect({ x: leaf.pose.x, y: leaf.pose.y, width: leaf.pose.width, height: leaf.pose.height })
      .toEqual({ x: 100 + G, y: 30 - G / 2 - 10, width: 18, height: 10 });
  });

  it('carries a port\'s label onto the resolved port', () => {
    const trait = bodyTrait(spec({ portLabels: { n: 'top' } }), BOUNDS, measure);
    const ports = portsOf({ id: 'n', kind: 'container', data: { diagram: trait } }, BOUNDS);
    expect(ports.find((p) => p.id === 'n')!.label).toBe('top');
    expect('label' in ports.find((p) => p.id === 's')!).toBe(false);
  });
});

describe('a node\'s margin under layout', () => {
  const node = (id: string, x: number, over: Partial<GraphNode> = {}): GraphNode =>
    ({ id, bounds: { x, y: 0, width: 50, height: 30 }, pinned: false, ...over });
  const graphOf = (nodes: GraphNode[]): Graph => ({
    nodes, edges: [], node: (id) => nodes.find((n) => n.id === id), outgoing: () => [], incoming: () => [],
  });

  it('keeps neighbors as far from the margin as from the box', () => {
    const margin = { top: 0, right: 30, bottom: 0, left: 0 };
    const nodes = [node('a', 0, { margin }), node('b', 200)];
    const moves = planOf(layered, graphOf(nodes), { nodeGap: 10 }).moves;
    const ax = moves.get('a')?.x ?? 0;
    const bx = moves.get('b')?.x ?? 200;
    expect(bx - (ax + 50)).toBeCloseTo(40);
  });

  it('reports the box\'s own top-left, and leaves a pinned box where it stands', () => {
    const margin = { top: 0, right: 0, bottom: 0, left: 25 };
    const moves = planOf(layered, graphOf([node('b', -500), node('a', 100, { margin, pinned: true })]), { nodeGap: 10 }).moves;
    expect(moves.has('a')).toBe(false);
    expect(moves.get('b')!.x).toBeCloseTo(100 - 25 - 10 - 50);
  });

  it('leaves every port where it was in the world', () => {
    const n = node('a', 10, {
      outline: 'diamond',
      margin: { top: 5, right: 30, bottom: 12, left: 7 },
      ports: [{ id: 'p', at: { u: 0.2, v: 0.2 }, sites: [{ u: 0.8, v: 1 }] }, { id: 'q', at: COMPASS.e }],
    });
    const before = portsOf({ id: 'a', kind: 'leaf', data: null }, n.bounds, {
      read: () => ({ ports: n.ports!, outline: n.outline! }),
    });
    const foot = footprintNode(n);
    expect(foot.bounds).toEqual({ x: 3, y: -5, width: 87, height: 47 });
    const after = portsOf({ id: 'a', kind: 'leaf', data: null }, foot.bounds, { read: () => ({ ports: foot.ports! }) });
    for (const [i, p] of before.entries()) {
      expect(after[i]!.point.x).toBeCloseTo(p.point.x);
      expect(after[i]!.point.y).toBeCloseTo(p.point.y);
      expect(after[i]!.normal).toEqual(p.normal);
    }
    const sites = (bounds: typeof n.bounds, read: () => object) =>
      portSitesOf({ id: 'a', kind: 'leaf', data: null }, bounds, 'p', { read: read as never });
    const was = sites(n.bounds, () => ({ ports: n.ports!, outline: n.outline! }));
    const now = sites(foot.bounds, () => ({ ports: foot.ports! }));
    expect(now).toHaveLength(2);
    expect(now[1]!.point.x).toBeCloseTo(was[1]!.point.x);
    expect(now[1]!.point.y).toBeCloseTo(was[1]!.point.y);
    expect(now[1]!.normal!.x).toBeCloseTo(was[1]!.normal!.x);
    expect(now[1]!.normal!.y).toBeCloseTo(was[1]!.normal!.y);
  });
});

describe('diagramScene port labels', () => {
  const textOf = (specs: DiagramSpec[], text: string) => specs.find((s) => s.data.text === text)!;
  const boxOf = (specs: DiagramSpec[], id: string) => specs.find((s) => s.id === id)!.pose;

  it('draws a node\'s portLabels as text beside its ports, in the node\'s text color', () => {
    const specs = diagramScene({ nodes: [{ id: 'a', lines: ['a'], portLabels: { e: 'out' } }], edges: [] }, { layout: 'none' });
    const label = textOf(specs, 'out');
    const a = boxOf(specs, 'a');
    expect(label.parent).toBe('a');
    expect(label.pose.x).toBeCloseTo(a.x + a.width + G);
    expect(label.data.fill).toEqual({ paint: { color: '#dbe7f2' } });
  });

  it('keeps a neighbor in the same rank clear of the label', () => {
    const specs = diagramScene({
      nodes: [{ id: 'r', lines: ['r'] }, { id: 'a', lines: ['a'], portLabels: { e: 'a long label' } }, { id: 'b', lines: ['b'] }],
      edges: [{ from: 'r', to: 'a' }, { from: 'r', to: 'b' }],
    }, { layoutOptions: { nodeGap: 4 } });
    const label = textOf(specs, 'a long label').pose;
    const b = boxOf(specs, 'b');
    const overlaps = (p: typeof b, q: typeof b) =>
      p.x < q.x + q.width && q.x < p.x + p.width && p.y < q.y + q.height && q.y < p.y + p.height;
    expect(overlaps(label, b)).toBe(false);
    expect(overlaps(label, boxOf(specs, 'r'))).toBe(false);
  });
});

describe('a group around a member with port labels', () => {
  const DATA: DiagramData = {
    nodes: [{ id: 'a', lines: ['a'], portLabels: { e: 'a long east label', s: 'south' } }, { id: 'b', lines: ['b'] }],
    edges: [{ from: 'a', to: 'b' }],
    groups: [{ id: 'G', members: ['a'] }],
  };
  const contains = (o: RectPose, i: RectPose) =>
    i.x >= o.x && i.y >= o.y && i.x + i.width <= o.x + o.width && i.y + i.height <= o.y + o.height;

  it('fits the labels inside the box, as built and as the scene derives it', () => {
    const specs = diagramScene(DATA, { layoutOptions: { direction: 'right' } });
    const built = (id: string) => specs.find((s) => s.id === id)!.pose;
    const labels = specs.filter((s) => s.data.text === 'a long east label' || s.data.text === 'south');
    expect(labels).toHaveLength(2);
    for (const l of labels) expect(contains(built('G'), l.pose)).toBe(true);

    const scene = createScene<unknown, 'main', RectPose>({
      systemLayers: [{ id: 'main' }], initial: specs as never, registry: withDiagramRegistry(),
    });
    const box = effectivePose(scene as never, scene.get('G' as never)! as never) as RectPose;
    for (const l of labels) expect(contains(box, l.pose)).toBe(true);
  });
});
