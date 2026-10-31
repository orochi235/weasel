import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { offPageOps, setDiagramColor, withDiagramRegistry, type DataEdge, type DataNode } from '@weasel-js/diagram';
import { documentFromScene } from './fromScene';
import { documentSpecs } from './toScene';
import { DOC_DATA, MEASURE, docScene, type DocScene } from './testing/docScene';
import { asGraph } from './testing/asGraph';

const pageOf = (scene: DocScene, id: string) => documentFromScene(scene).pages.map(asGraph).find((p) => p.id === id)!;
const nodeOf = (scene: DocScene, page: string, id: string): DataNode => pageOf(scene, page).data.nodes.find((n) => n.id === id)!;
const edgeOf = (scene: DocScene, id: string): DataEdge => {
  const doc = documentFromScene(scene);
  return [...doc.pages.map(asGraph).flatMap((p) => p.data.edges), ...(doc.crossPageEdges ?? [])].find((e) => e.id === id)!;
};
const editEdge = (scene: DocScene, id: string, trait: Record<string, unknown>) => {
  const data = scene.get(id as never)!.data as { diagram: Record<string, unknown> };
  scene.update(id as never, { data: { ...data, diagram: { ...data.diagram, ...trait } } });
};

describe('documentFromScene', () => {
  it('reads the pages and the theme the scene names', () => {
    const doc = documentFromScene(docScene());
    expect(doc.pages.map(asGraph).map(({ id, name, width, height }) => ({ id, name, width, height }))).toEqual([
      { id: 'p1', name: undefined, width: 1000, height: 700 },
      { id: 'p2', name: 'Second', width: 1000, height: 700 },
    ]);
    expect(doc.theme).toBe('night');
  });

  it('puts each shape on the page it sits on, at its place on that page', () => {
    const scene = docScene();
    expect(pageOf(scene, 'p1').data.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'm']);
    expect(nodeOf(scene, 'p2', 'c').at).toEqual({ x: 60, y: 60 });
    expect(nodeOf(scene, 'p1', 'a').at).toEqual({ x: 40, y: 40 });
  });

  it('reads a shape\'s outline, text, size, and role', () => {
    const scene = docScene();
    const b = scene.get('b' as never)!.pose as { width: number; height: number };
    expect(nodeOf(scene, 'p1', 'b')).toMatchObject({ outline: 'diamond', lines: ['Check'], width: b.width, height: b.height });
    expect(nodeOf(scene, 'p1', 'a').style).toBe('accent');
  });

  it('keeps only the colors the theme does not give', () => {
    const scene = docScene();
    expect(nodeOf(scene, 'p1', 'b').colors).toEqual({ fill: '#123456' });
    expect(nodeOf(scene, 'p1', 'a').colors).toBeUndefined();
    setDiagramColor(scene as never, ['a'], 'stroke', '#00ff00');
    expect(nodeOf(scene, 'p1', 'a').colors).toEqual({ stroke: '#00ff00' });
  });

  it('reads an edge\'s ends, router, waypoints, and label', () => {
    expect(edgeOf(docScene(), 'ab')).toMatchObject({
      from: 'a', to: 'b', router: 'orthogonal', waypoints: [{ x: 200, y: 160 }], label: 'yes',
    });
  });

  it('keeps an edge whose ends are on different pages apart, without waypoints', () => {
    const doc = documentFromScene(docScene());
    expect(doc.crossPageEdges?.map((e) => e.id)).toEqual(['ac']);
    expect(doc.crossPageEdges![0]).toMatchObject({ from: 'a', to: 'c', router: 'bezier', label: 'away' });
    expect(doc.pages.map(asGraph).flatMap((p) => p.data.edges).map((e) => e.id)).toEqual(['ab', 'bm']);
  });

  it('reads a route layout owns, and an avoiding route, as routed rather than as waypoints', () => {
    const scene = docScene();
    editEdge(scene, 'ab', { laidOut: [{ x: 200, y: 160 }] });
    editEdge(scene, 'bm', { router: 'avoid', route: [{ x: 300, y: 260 }] });
    expect(edgeOf(scene, 'ab')).toMatchObject({ routed: [{ x: 200, y: 160 }] });
    expect(edgeOf(scene, 'ab').waypoints).toBeUndefined();
    expect(edgeOf(scene, 'bm')).toMatchObject({ router: 'avoid', routed: [{ x: 300, y: 260 }] });
  });

  it('reads containers, with their members and boxes on their page', () => {
    const scene = docScene();
    expect(pageOf(scene, 'p1').data.containers).toEqual([
      { id: 'k', role: 'container', label: 'Box', members: ['m'], box: { x: 300, y: 40, width: 220, height: 140 } },
    ]);
  });

  it('reads a pool\'s axis, box, and lanes, each lane with its size and members', () => {
    const [pool] = pageOf(docScene(), 'p2').data.containers!;
    expect(pool).toMatchObject({ id: 'p', role: 'pool', label: 'Pool', axis: 'y', box: { x: 40, y: 300, width: 400, height: 240 } });
    expect(pool!.lanes).toEqual([
      { id: 'l1', label: 'One', size: 120, members: ['d'] },
      { id: 'l2', label: 'Two', size: 120 },
    ]);
  });

  it('leaves out a fitted container\'s box, which fits its members again', () => {
    const data = { ...DOC_DATA, containers: [{ ...DOC_DATA.containers![0]!, box: undefined }] };
    expect(pageOf(docScene(data), 'p1').data.containers![0]!.box).toBeUndefined();
  });

  describe('a shape in the gap between pages', () => {
    // 37 wide, the narrowest a shape gets, so at x 1001 or 1002 it fits the 40 gap with 1 and 2 to spare.
    const withGap = (x: number, edge: DataEdge): DocScene => docScene({
      ...DOC_DATA,
      nodes: [...DOC_DATA.nodes, { id: 'g', lines: ['Gap'], at: { x, y: 60 }, width: 37 }],
      edges: [...DOC_DATA.edges, edge],
    });

    it('exports a shape in the gap with the page nearest it, not the first', () => {
      const scene = withGap(1002, { id: 'gc', from: 'g', to: 'c' });
      expect(pageOf(scene, 'p2').data.nodes.map((n) => n.id)).toContain('g');
      expect(pageOf(scene, 'p1').data.nodes.map((n) => n.id)).not.toContain('g');
    });

    it('marks a connector cross-page exactly when the scene splits it', () => {
      const scene = withGap(1002, { id: 'gc', from: 'g', to: 'c' });
      const doc = documentFromScene(scene);
      expect(doc.crossPageEdges?.map((e) => e.id)).toEqual(['ac']);
      expect(pageOf(scene, 'p2').data.edges.map((e) => e.id)).toEqual(['gc']);
    });

    it('keeps a connector from a gap shape to another page whole, with its waypoints', () => {
      const wp = [{ x: 1020, y: 200 }];
      const scene = withGap(1001, { id: 'gc', from: 'g', to: 'c', router: 'orthogonal', waypoints: wp });
      const doc = documentFromScene(scene);
      expect(pageOf(scene, 'p1').data.nodes.map((n) => n.id)).toContain('g');
      expect(doc.crossPageEdges?.find((e) => e.id === 'gc')?.waypoints).toEqual(wp);
      const imported = documentSpecs(doc, { measure: MEASURE });
      const live = createScene<unknown, string, RectPose>({
        systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), doc: imported.doc, initial: imported.specs as never,
      });
      const splitIds = offPageOps(live, 'all').filter((o) => o.name === 'setData').map((o) => (o.args as { id: string }).id);
      expect(splitIds).toContain('ac');
      expect(splitIds).not.toContain('gc');
    });
  });

  describe('where the scene splits a connector', () => {
    it('reads a group at its derived box, not its stale stored pose', () => {
      const scene = docScene({
        ...DOC_DATA,
        nodes: [
          ...DOC_DATA.nodes,
          { id: 'e', lines: ['E'], at: { x: 1500, y: 400 }, width: 64 },
          { id: 'f', lines: ['F'], at: { x: 1500, y: 500 }, width: 64 },
        ],
        groups: [{ id: 'G', members: ['e', 'f'] }],
        edges: [...DOC_DATA.edges, { id: 'Gb', from: 'G', to: 'b', router: 'orthogonal', waypoints: [{ x: 500, y: 600 }] }],
      });
      scene.setPose('e' as never, { x: 100, y: 400, width: 64, height: 32 });
      scene.setPose('f' as never, { x: 100, y: 500, width: 64, height: 32 });
      expect(scene.get('G' as never)!.pose).toMatchObject({ x: expect.any(Number) });
      expect((scene.get('G' as never)!.pose as { x: number }).x).toBeGreaterThan(1000);
      expect(pageOf(scene, 'p1').data.groups?.map((g) => g.id)).toEqual(['G']);
      expect(pageOf(scene, 'p1').data.edges.find((e) => e.id === 'Gb')?.waypoints).toBeDefined();
      expect(documentFromScene(scene).crossPageEdges?.map((e) => e.id)).not.toContain('Gb');
    });

    it('keeps a split connector in crossPageEdges even when both ends export to one page', () => {
      const scene = docScene({
        ...DOC_DATA,
        nodes: [...DOC_DATA.nodes, { id: 'q', lines: ['Q'], at: { x: 1050, y: 320 }, width: 64 }],
        edges: [...DOC_DATA.edges, { id: 'qa', from: 'q', to: 'a' }],
        containers: [
          ...DOC_DATA.containers!,
          { id: 'K2', role: 'container', label: 'Wide', members: ['q'], box: { x: 700, y: 300, width: 450, height: 140 } },
        ],
      });
      const doc = documentFromScene(scene);
      expect(pageOf(scene, 'p1').data.nodes.map((n) => n.id)).toContain('q');
      expect(doc.crossPageEdges?.map((e) => e.id)).toContain('qa');
      expect(pageOf(scene, 'p1').data.edges.map((e) => e.id)).not.toContain('qa');
    });
  });

  it('reads a shape\'s divider rows back in their places among its text rows', () => {
    const rows: DataNode['rows'] = [{ kind: 'label', text: 'Order' }, { kind: 'divider' }, { kind: 'label', text: 'id' }, { kind: 'divider', inset: 4 }];
    const scene = docScene({ ...DOC_DATA, nodes: [...DOC_DATA.nodes, { id: 'u', rows, at: { x: 600, y: 300 } }] });
    expect(nodeOf(scene, 'p1', 'u').rows).toEqual([
      { kind: 'label', text: 'Order' }, { kind: 'divider' }, { kind: 'label', text: 'id' }, { kind: 'divider', inset: 4 },
    ]);
    expect(nodeOf(scene, 'p1', 'u').lines).toBeUndefined();
  });

  it('reads a field row back as a field, and as text once its label is edited away', () => {
    const rows: DataNode['rows'] = [{ kind: 'label', text: 'Order' }, { kind: 'divider' }, { kind: 'field', label: 'int', value: 'id PK' }];
    const scene = docScene({ ...DOC_DATA, nodes: [...DOC_DATA.nodes, { id: 'u', rows, at: { x: 600, y: 300 } }] });
    expect(nodeOf(scene, 'p1', 'u').rows).toEqual(rows);
    const row = scene.childrenOf('u' as never).find((id) => (scene.get(id)!.data as { bodyField?: string }).bodyField === 'int')!;
    scene.update(row, { data: { ...(scene.get(row)!.data as object), text: 'renamed' } });
    expect(nodeOf(scene, 'p1', 'u').rows![2]).toEqual({ kind: 'label', text: 'renamed' });
  });

  it('reads the labels at an edge\'s ends', () => {
    const edges = DOC_DATA.edges.map((e, i) => (i === 0 ? { ...e, endLabels: { from: '1', to: '0..*' } } : e));
    const scene = docScene({ ...DOC_DATA, edges });
    const id = DOC_DATA.edges[0]!.id!;
    expect(edgeOf(scene, id).endLabels).toEqual({ from: '1', to: '0..*' });
    expect(edgeOf(scene, id).label).toBe(DOC_DATA.edges[0]!.label);
  });
});
