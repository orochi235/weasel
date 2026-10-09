import { describe, expect, it } from 'vitest';
import { createScene } from '@weasel-js/core';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';
import { withDiagramRegistry } from './edge';
import type { DiagramNode } from './types';

const DATA: DiagramData = {
  nodes: [
    { id: 'a', lines: ['level mix', '0–1'] },
    { id: 'b', lines: ['warm'] },
    { id: 'c', lines: ['color', 'hex'] },
  ],
  edges: [{ from: 'a', to: 'b', label: 'weight' }, { from: 'b', to: 'c' }],
};

const containers = (specs: ReturnType<typeof diagramScene>) =>
  specs.filter((s) => s.kind === 'container');

describe('diagramScene', () => {
  it('makes one container per node, carrying the data id', () => {
    expect(containers(diagramScene(DATA)).map((s) => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('makes one text child per line, unpickable', () => {
    const texts = diagramScene(DATA).filter((s) => s.data?.text !== undefined && s.parent === ('a' as never));
    expect(texts.map((t) => t.data?.text)).toEqual(['level mix', '0–1']);
    expect(texts.every((t) => t.pickable === false)).toBe(true);
  });

  it('lays nodes out in ranks running down by default', () => {
    const ys = containers(diagramScene(DATA)).map((s) => (s.pose as { y: number }).y);
    expect(ys[0]).toBeLessThan(ys[1]!);
    expect(ys[1]).toBeLessThan(ys[2]!);
  });

  it('gives each edge a stable id and a label node', () => {
    const specs = diagramScene(DATA);
    const edge = specs.find((s) => s.id === (edgeIdOf(DATA.edges[0]!) as never));
    expect(edge?.dependsOn).toEqual(['a', 'b']);
    expect(specs.some((s) => s.data?.text === 'weight' && s.dependsOn?.[0] === edge?.id)).toBe(true);
  });

  it('drops an edge whose end is not a node', () => {
    const specs = diagramScene({ nodes: DATA.nodes, edges: [{ from: 'a', to: 'nowhere' }] });
    expect(specs.some((s) => s.dependsOn !== undefined)).toBe(false);
  });

  it('applies nodeStyle and edgeStyle', () => {
    const specs = diagramScene(DATA, {
      nodeStyle: () => ({ fill: '#000000', stroke: '#ff0000', text: '#ffffff', strokeWidth: 3 }),
      edgeStyle: () => ({ stroke: '#00ff00', width: 1 }),
    });
    expect(containers(specs)[0]!.data?.stroke).toEqual({ paint: { color: '#ff0000' }, width: 3 });
    const edge = specs.find((s) => s.id === (edgeIdOf(DATA.edges[1]!) as never));
    expect(edge?.data?.stroke).toMatchObject({ paint: { color: '#00ff00' }, width: 1 });
  });

  it('handles one node and no edges', () => {
    expect(containers(diagramScene({ nodes: [{ id: 'pose', lines: ['pose'] }], edges: [] }))).toHaveLength(1);
  });

  it('loads into a scene', () => {
    const scene = createScene({
      systemLayers: [{ id: 'main' as const }],
      initial: diagramScene(DATA),
      registry: withDiagramRegistry(),
    });
    expect(scene.get('b' as never)).toBeDefined();
  });

  it('throws on a repeated node id', () => {
    const data = { nodes: [{ id: 'a', lines: ['a'] }, { id: 'a', lines: ['again'] }], edges: [] };
    expect(() => diagramScene(data)).toThrow(/"a" appears more than once/);
  });

  it('drops a repeat of an edge with the same ends and label', () => {
    const data = {
      nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }],
      edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'b' }, { from: 'a', to: 'b', label: 'x' }],
    };
    const ids = diagramScene(data).map((s) => s.id).filter((id) => String(id).startsWith('edge:'));
    expect(ids).toEqual(['edge:a->b', 'edge:a->b:x']);
  });

  it('passes outline, ports and pinned into the trait', () => {
    const ports = [{ id: 'in', at: { u: 0, v: 0.5 }, type: 'num' }];
    const specs = diagramScene({
      nodes: [{ id: 'q', lines: ['ready?'], outline: 'diamond', ports, pinned: true, at: { x: 500, y: 40 } }],
      edges: [],
    });
    const box = containers(specs)[0]!;
    expect(box.data?.diagram).toEqual({ outline: 'diamond', ports, pinned: true });
    expect(box.pose).toMatchObject({ x: 500, y: 40 });
  });

  it('draws rows, bolding a bold row and skipping a slot', () => {
    const specs = diagramScene({
      nodes: [{
        id: 'op',
        rows: [
          { kind: 'label', text: 'mix', style: { bold: true } },
          { kind: 'field', label: 'rate', value: '2' },
          { kind: 'slot', height: 20 },
        ],
      }],
      edges: [],
    });
    const texts = specs.filter((s) => s.data?.text !== undefined);
    expect(texts.map((t) => t.data?.text)).toEqual(['mix', 'rate: 2']);
    expect(texts[0]!.data?.style?.fontWeight).toBe(700);
    expect(texts[1]!.data?.style?.fontWeight).toBeUndefined();
  });

  it('gives a ports row its ports and draws their labels', () => {
    const specs = diagramScene({
      nodes: [{ id: 'op', rows: [{ kind: 'ports', left: [{ id: 'a', label: 'in', type: 'num' }], right: [{ id: 'b' }] }] }],
      edges: [],
    });
    const trait = containers(specs)[0]!.data?.diagram as DiagramNode;
    expect(trait.ports!.map((p) => p.id)).toEqual(['n', 's', 'a', 'b']);
    expect(specs.some((s) => s.data?.text === 'in')).toBe(true);
  });

  it('grows a box to its content, never below width and height', () => {
    const [big] = containers(diagramScene({ nodes: [{ id: 'a', lines: ['x'], width: 200, height: 90 }], edges: [] }));
    expect(big!.pose).toMatchObject({ width: 200, height: 90 });
    const [roomy] = containers(diagramScene({ nodes: [{ id: 'a', lines: ['x'], padding: 30 }], edges: [] }));
    const [tight] = containers(diagramScene({ nodes: [{ id: 'a', lines: ['x'], padding: 2 }], edges: [] }));
    expect((roomy!.pose as { height: number }).height).toBeGreaterThan((tight!.pose as { height: number }).height);
  });

  it('measures with a given measure', () => {
    const measure = () => ({ width: 300, height: 40 });
    const [box] = containers(diagramScene({ nodes: [{ id: 'a', lines: ['x'] }], edges: [] }, { measure }));
    expect((box!.pose as { width: number }).width).toBeGreaterThanOrEqual(300);
  });

  it('names ports, router, waypoints and markers on an edge', () => {
    const edge = { from: 'a', to: 'b', fromPort: 's', toPort: 'n', router: 'orthogonal' as const, waypoints: [{ x: 5, y: 5 }] };
    const specs = diagramScene({ nodes: DATA.nodes, edges: [edge] }, {
      edgeStyle: () => ({ stroke: '#fff', dash: [4, 2], markerStart: 'dot', markerEnd: null }),
    });
    const spec = specs.find((s) => s.id === (edgeIdOf(edge) as never))!;
    expect(edgeIdOf(edge)).toBe('edge:a.s->b.n');
    expect(spec.data?.diagram).toEqual({ from: { port: 's' }, to: { port: 'n' }, router: 'orthogonal', waypoints: [{ x: 5, y: 5 }] });
    expect(spec.data?.stroke).toEqual({ paint: { color: '#fff' }, width: 1.5, dash: [4, 2], markerStart: 'dot' });
  });

  it('places a label where the edge says, colored by the style', () => {
    const specs = diagramScene(
      { nodes: DATA.nodes, edges: [{ from: 'a', to: 'b', label: 'w', labelPlacement: { at: 0.25 } }] },
      { edgeStyle: () => ({ stroke: '#111', label: '#222' }) },
    );
    const label = specs.find((s) => s.data?.text === 'w')!;
    expect(label.data?.diagram).toEqual({ label: { at: 0.25 } });
    expect(label.data?.fill).toEqual({ color: '#222' });
  });

  it('takes a layout by name, or a function given barycenter under partial layoutOptions', () => {
    let got: unknown;
    diagramScene(DATA, { layout: (_g, o) => ((got = o), new Map()), layoutOptions: { direction: 'right' } });
    expect(got).toEqual({ order: 'barycenter', direction: 'right' });
    const ranks = containers(diagramScene(DATA, { layout: 'tree', layoutOptions: { direction: 'right' } }))
      .map((s) => (s.pose as { x: number }).x);
    expect(ranks[0]).toBeLessThan(ranks[2]!);
  });
});
