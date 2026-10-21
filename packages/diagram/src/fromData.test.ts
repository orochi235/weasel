import { describe, expect, it } from 'vitest';
import { createScene } from '@weasel-js/core';
import { DIAGRAM_THEMES } from './theme/themes';
import { DEFAULT_NODE_STYLE, diagramScene, edgeIdOf, type DataNode, type DiagramData, type DiagramSceneOptions } from './fromData';
import { withDiagramRegistry } from './edge';
import type { DiagramNode } from './types';
import { createSpecLabelPlacer } from './labels/specLabels';
import type { DiagramLabel } from './labelTrait';

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

  it('keeps the default style where a style callback answers undefined', () => {
    const plain = diagramScene(DATA);
    const some = diagramScene(DATA, {
      nodeStyle: (n) => (n.id === 'a' ? { ...DEFAULT_NODE_STYLE, fill: '#333333' } : undefined),
      edgeStyle: () => undefined,
    });
    const fillOf = (specs: typeof plain, id: string) => specs.find((s) => s.id === id)!.data?.fill;
    expect(fillOf(some, 'a')).toEqual({ paint: { color: '#333333' } });
    expect(fillOf(some, 'b')).toEqual(fillOf(plain, 'b'));
    const edge = (specs: typeof plain) => specs.find((s) => s.id === (edgeIdOf(DATA.edges[1]!) as never))!.data?.stroke;
    expect(edge(some)).toEqual(edge(plain));
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
    const ids = diagramScene(data).map((s) => s.id).filter((id) => String(id).startsWith('edge:') && !String(id).includes('/'));
    expect(ids).toEqual(['edge:a->b', 'edge:a->b:x']);
  });

  it('passes outline, ports and pinned into the trait', () => {
    const ports = [{ id: 'in', at: { u: 0, v: 0.5 }, type: 'num' }];
    const specs = diagramScene({
      nodes: [{ id: 'q', lines: ['ready?'], outline: 'diamond', ports, pinned: true, at: { x: 500, y: 40 } }],
      edges: [],
    });
    const box = containers(specs)[0]!;
    expect(box.data?.diagram).toEqual({
      outline: 'diamond', ports, pinned: true, body: { padding: 8, gap: 4, verticalAlign: 'center', rows: 1 },
    });
    expect(box.pose).toMatchObject({ x: 500, y: 40 });
  });

  it('draws rows, bolding a bold row, centering a label row, and skipping a slot', () => {
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
    expect(texts.map((t) => t.data?.style?.align)).toEqual(['center', undefined]);
  });

  it('gives a slot with an id a scene node of that name, an empty frame in its box', () => {
    const specs = diagramScene({
      nodes: [{ id: 'op', rows: [{ kind: 'label', text: 'mix' }, { kind: 'slot', height: 20, width: 30, id: 'well' }] }],
      edges: [],
    });
    const well = specs.find((s) => s.id === 'op/well')!;
    expect(well.parent).toBe('op');
    expect(well.pose).toMatchObject({ width: 30, height: 20 });
    expect(well.data?.diagram).toEqual({ mark: { d: 'M0 0H1V1H0Z' } });
    expect(well.data?.fill).toBeUndefined();
    expect(well.data?.stroke).toBeDefined();
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

  it('centers a short label in a tall box unless the node or the scene says otherwise', () => {
    const labelY = (node: Partial<DataNode>, opts?: DiagramSceneOptions) => {
      const specs = diagramScene({ nodes: [{ id: 'a', lines: ['x'], height: 90, ...node }], edges: [] }, opts);
      const box = containers(specs)[0]!.pose as { y: number; height: number };
      const text = specs.find((s) => s.data?.text === 'x')!.pose as { y: number; height: number };
      return (text.y + text.height / 2 - box.y) / box.height;
    };
    expect(labelY({})).toBeCloseTo(0.5);
    expect(labelY({ verticalAlign: 'top' })).toBeLessThan(0.3);
    expect(labelY({}, { verticalAlign: 'bottom' })).toBeGreaterThan(0.7);
    expect(labelY({ verticalAlign: 'top' }, { verticalAlign: 'bottom' })).toBeLessThan(0.3);
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

  it('gives distinct edges distinct ids, whatever their ids, ports and labels hold', () => {
    const edges = [
      { from: 'a.b', to: 'c' }, { from: 'a', fromPort: 'b', to: 'c' },
      { from: 'a->b', to: 'c' }, { from: 'a', to: 'b->c' },
      { from: 'a', to: 'b:x' }, { from: 'a', to: 'b', label: 'x' },
      { from: 'a', to: 'b', label: 'x/label' },
      { from: 'a\\', fromPort: 'p', to: 'b' }, { from: 'a', fromPort: '\\.p', to: 'b' },
      { from: 'a', to: 'b' }, { from: 'a', fromPort: '', to: 'b' }, { from: 'a', to: 'b', toPort: '' },
      { from: 'a', to: 'b', label: '' },
    ];
    const ids = edges.map(edgeIdOf);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain(`${edgeIdOf({ from: 'a', to: 'b', label: 'x' })}/label`);
    expect(edgeIdOf({ from: 'osc-1', to: 'out' })).toBe('edge:osc-1->out');
  });

  it('places a label where the edge says, colored by the style', () => {
    const specs = diagramScene(
      { nodes: DATA.nodes, edges: [{ from: 'a', to: 'b', label: 'w', labelPlacement: { at: 0.25 } }] },
      { edgeStyle: () => ({ stroke: '#111', label: '#222' }) },
    );
    const label = specs.find((s) => s.data?.text === 'w')!;
    expect(label.data?.diagram).toEqual({ label: { at: 0.25 } });
    expect(label.data?.fill).toEqual({ paint: { color: '#222' } });
  });

  it('keeps a dragged label where it was left under layered layout and dodging', () => {
    const labelUnderCover = (labelPlacement: DiagramLabel) => {
      const edge = { from: 'a', to: 'b', label: 'w', labelPlacement };
      const laid = diagramScene({ nodes: DATA.nodes.slice(0, 2), edges: [edge] }, { layout: 'layered' });
      const [a, b] = ['a', 'b'].map((id) => laid.find((s) => s.id === id)!.pose as { x: number; y: number; width: number; height: number });
      const top = a!.y + a!.height + 4;
      // Added after layout, which would otherwise lay the edge out around it.
      const cover = diagramScene({ nodes: [{ id: 'cover', lines: [], at: { x: a!.x - 40, y: top }, width: a!.width + 80, height: (b!.y - top) / 2 }], edges: [] }, { layout: 'none' });
      const specs = createSpecLabelPlacer()([...laid, ...cover]);
      return (specs.find((s) => s.id === `${edgeIdOf(edge)}/label`)!.data?.diagram as { label: unknown }).label;
    };
    expect(labelUnderCover({ at: 0.3, offset: 12 })).toHaveProperty('placed');
    expect(labelUnderCover({ at: 0.3, offset: 12, dodge: false })).toEqual({ at: 0.3, offset: 12, dodge: false });
  });

  it('takes a layout by name, or a function given barycenter under partial layoutOptions', () => {
    let got: unknown;
    diagramScene(DATA, { layout: (_g, o) => ((got = o), new Map()), layoutOptions: { direction: 'right' } });
    expect(got).toEqual({ order: 'barycenter', direction: 'right' });
    const ranks = containers(diagramScene(DATA, { layout: 'tree', layoutOptions: { direction: 'right' } }))
      .map((s) => (s.pose as { x: number }).x);
    expect(ranks[0]).toBeLessThan(ranks[2]!);
  });

  it('gives every spec an id, the same on every call', () => {
    const a = diagramScene(DATA).map((s) => s.id);
    expect(a.every((id) => id !== undefined)).toBe(true);
    expect(new Set(a).size).toBe(a.length);
    expect(diagramScene(DATA).map((s) => s.id)).toEqual(a);
  });

  it("leaves every node at its own position under layout 'none'", () => {
    const specs = diagramScene(
      { nodes: [{ id: 'a', lines: ['a'], at: { x: 300, y: 7 } }, { id: 'b', lines: ['b'], at: { x: 0, y: 0 } }], edges: [{ from: 'a', to: 'b' }] },
      { layout: 'none' },
    );
    expect(containers(specs).map((s) => s.pose)).toMatchObject([{ x: 300, y: 7 }, { x: 0, y: 0 }]);
  });

  it("draws a stored `routed` route as layout's own, so a later layout may replace it", () => {
    const routed = [{ x: 50, y: 50 }];
    const edgeOf = (edge: DiagramData['edges'][number]) => {
      const specs = diagramScene({ nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }], edges: [edge] }, { layout: 'none' });
      return (specs.find((s) => s.id === edgeIdOf(edge))!.data as { diagram: { waypoints?: unknown; laidOut?: unknown } }).diagram;
    };
    expect(edgeOf({ from: 'a', to: 'b', routed })).toMatchObject({ waypoints: routed, laidOut: routed });
    const own = [{ x: 9, y: 9 }];
    const authored = edgeOf({ from: 'a', to: 'b', routed, waypoints: own });
    expect(authored.waypoints).toEqual(own);
    expect(authored.laidOut).toBeUndefined();
  });

  it("draws stored `routedPorts` as layout's own, under the same edge id", () => {
    const endsOf = (edge: DiagramData['edges'][number]) => {
      const specs = diagramScene({ nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }], edges: [edge] }, { layout: 'none' });
      return (specs.find((s) => s.id === edgeIdOf(edge))!.data as { diagram: { from: unknown; to: unknown } }).diagram;
    };
    expect(edgeIdOf({ from: 'a', to: 'b', routedPorts: { from: 's', to: 'n' } })).toBe(edgeIdOf({ from: 'a', to: 'b' }));
    expect(endsOf({ from: 'a', to: 'b', routedPorts: { from: 's', to: 'n' } }))
      .toMatchObject({ from: { port: 's', laidOut: 's' }, to: { port: 'n', laidOut: 'n' } });
    const own = endsOf({ from: 'a', to: 'b', fromPort: 'e', routedPorts: { from: 's', to: 'n' } });
    expect(own.from).toEqual({ port: 'e' });
    expect(own.to).toEqual({ port: 'n', laidOut: 'n' });
  });
});

describe('edgeIdOf with an authored id', () => {
  it('returns the id when set, and the derived one when not', () => {
    expect(edgeIdOf({ id: 'w1', from: 'a', to: 'b', label: 'x' })).toBe('w1');
    expect(edgeIdOf({ from: 'a', to: 'b', label: 'x' })).toBe('edge:a->b:x');
  });
});

describe('diagramScene under a theme', () => {
  const theme = DIAGRAM_THEMES.pastel!;
  const data: DiagramData = {
    nodes: [{ id: 'a', lines: ['a'], style: 'warning' }, { id: 'b', lines: ['b'] }],
    edges: [{ from: 'a', to: 'b', label: 'go' }],
    groups: [{ id: 'g', members: ['a'], label: 'G' }],
  };
  type Painted = { fill?: { paint: { color: string } }; stroke?: { paint: { color: string } }; style?: { fontFamily: string }; diagram?: DiagramNode };
  const byId = (specs: ReturnType<typeof diagramScene>) => new Map(specs.map((s) => [s.id as string, s.data as Painted]));

  it('draws a node in its role, keeping the role on its trait, and one naming none in the default role', () => {
    const specs = byId(diagramScene(data, { theme }));
    expect(specs.get('a')!.fill!.paint.color).toBe(theme.roles.warning!.fill);
    expect(specs.get('a')!.stroke!.paint.color).toBe(theme.roles.warning!.stroke);
    expect(specs.get('a')!.diagram!.style).toBe('warning');
    expect(specs.get('b')!.fill!.paint.color).toBe(theme.roles.default!.fill);
    expect(specs.get('b')!.diagram!.style).toBeUndefined();
  });

  it("draws edges, labels, groups, and text in the theme's colors and face", () => {
    const specs = diagramScene(data, { theme });
    const map = byId(specs);
    const edge = edgeIdOf(data.edges[0]!);
    expect(map.get(edge)!.stroke!.paint.color).toBe(theme.edge.stroke);
    expect(map.get(`${edge}/label`)!.fill!.paint.color).toBe(theme.label.fill);
    expect(map.get('g')!.fill!.paint.color).toBe(theme.container.fill);
    const row = specs.find((s) => s.parent === 'b')!.data as Painted;
    expect(row.fill!.paint.color).toBe(theme.roles.default!.text);
    expect(row.style!.fontFamily).toBe(theme.font.family);
  });

  it('lets nodeStyle win over the role', () => {
    const style = { fill: '#010101', stroke: '#020202', text: '#030303' };
    expect(byId(diagramScene(data, { theme, nodeStyle: () => style })).get('a')!.fill!.paint.color).toBe('#010101');
  });

  it('ignores a role without a theme', () => {
    expect(byId(diagramScene(data)).get('a')!.fill!.paint.color).toBe(DEFAULT_NODE_STYLE.fill);
  });
});
