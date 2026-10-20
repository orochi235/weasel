import { describe, expect, it } from 'vitest';
import { setDiagramColor, type DataEdge, type DataNode } from '@weasel-js/diagram';
import { documentFromScene } from './fromScene';
import { DOC_DATA, docScene, type DocScene } from './testing/docScene';

const pageOf = (scene: DocScene, id: string) => documentFromScene(scene).pages.find((p) => p.id === id)!;
const nodeOf = (scene: DocScene, page: string, id: string): DataNode => pageOf(scene, page).data.nodes.find((n) => n.id === id)!;
const edgeOf = (scene: DocScene, id: string): DataEdge => {
  const doc = documentFromScene(scene);
  return [...doc.pages.flatMap((p) => p.data.edges), ...(doc.crossPageEdges ?? [])].find((e) => e.id === id)!;
};
const editEdge = (scene: DocScene, id: string, trait: Record<string, unknown>) => {
  const data = scene.get(id as never)!.data as { diagram: Record<string, unknown> };
  scene.update(id as never, { data: { ...data, diagram: { ...data.diagram, ...trait } } });
};

describe('documentFromScene', () => {
  it('reads the pages and the theme the scene names', () => {
    const doc = documentFromScene(docScene());
    expect(doc.pages.map(({ id, name, width, height }) => ({ id, name, width, height }))).toEqual([
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
    expect(doc.pages.flatMap((p) => p.data.edges).map((e) => e.id)).toEqual(['ab', 'bm']);
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
});
