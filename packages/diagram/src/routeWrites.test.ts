import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from './edge';
import type { DiagramEdge } from './edgeTrait';
import { diagramScene, edgeIdOf, type DiagramData } from './fromData';
import { buildGraph } from './graph';
import { layered } from './layered';
import { planOf } from './layout';
import { applyLayout } from './layoutAction';
import { sceneParticipants } from './portLayer';
import { routesOf } from './routeWrites';
import { tree } from './tree';

function load(data: DiagramData) {
  const scene = createScene<unknown, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: diagramScene(data) as never,
    registry: withDiagramRegistry(),
  });
  const relayout = (fn = layered) => {
    const graph = buildGraph<RectPose>(sceneParticipants(scene as never));
    const plan = planOf(fn, graph);
    applyLayout(scene, plan.moves, { routes: routesOf(graph, plan) });
  };
  const edge = (id: string) => (scene.get(id as never)!.data as { diagram: DiagramEdge }).diagram;
  return { scene, relayout, edge };
}

// `x` comes first, so the walk that breaks the cycle reaches `b` before `a`
// and turns `a → b` around: it runs back up from `a` to `b`. With `x` gone,
// the walk starts at `a`, and `a → b` runs down.
const CYCLE: DiagramData = {
  nodes: [{ id: 'x', lines: ['x'] }, { id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }],
  edges: [{ from: 'x', to: 'b' }, { from: 'b', to: 'a' }, { from: 'a', to: 'b' }],
};
const AB = edgeIdOf({ from: 'a', to: 'b' });

describe('ports layout named', () => {
  it('are marked as layout\'s, and named again by a later layout', () => {
    const { scene, relayout, edge } = load(CYCLE);
    expect(edge(AB)).toMatchObject({ from: { port: 'n' }, to: { port: 's' } });
    scene.remove(edgeIdOf({ from: 'x', to: 'b' }) as never);
    scene.remove('x' as never);
    relayout();
    expect(edge(AB)).toMatchObject({ from: { port: 's' }, to: { port: 'n' } });
  });

  it('are left alone once someone names another', () => {
    const { scene, relayout, edge } = load(CYCLE);
    const data = scene.get(AB as never)!.data as { diagram: DiagramEdge };
    scene.update(AB as never, { data: { ...data, diagram: { ...data.diagram, from: { port: 'e' } } } });
    scene.remove(edgeIdOf({ from: 'x', to: 'b' }) as never);
    scene.remove('x' as never);
    relayout();
    expect(edge(AB).from).toEqual({ port: 'e' });
    expect(edge(AB).to).toMatchObject({ port: 'n' });
  });

  it('are taken back by a layout that names none', () => {
    const { relayout, edge } = load(CYCLE);
    relayout(tree);
    expect(edge(AB).from).toEqual({});
    expect(edge(AB).to).toEqual({});
  });
});

describe('an avoid connector under layout', () => {
  const SPAN: DiagramData = {
    nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'c', lines: ['c'] }],
    edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'a', to: 'c', router: 'avoid' }],
  };
  const AC = edgeIdOf({ from: 'a', to: 'c' });

  it('gets no waypoints from layout, but still its ports', () => {
    const { scene, relayout, edge } = load(SPAN);
    expect(edge(AC).waypoints).toBeUndefined();
    const data = scene.get(AC as never)!.data as { diagram: DiagramEdge };
    scene.update(AC as never, { data: { ...data, diagram: { ...data.diagram, from: {}, to: {} } } });
    relayout();
    expect(edge(AC).waypoints).toBeUndefined();
    expect(edge(AC).laidOut).toBeUndefined();
    expect(edge(AC).from).toMatchObject({ port: 's' });
  });

  it('is the only one layout leaves without waypoints', () => {
    const { relayout, edge } = load({ ...SPAN, edges: SPAN.edges.map(({ router: _r, ...e }) => e) });
    relayout();
    expect(edge(AC).waypoints?.length).toBeGreaterThan(0);
  });
});
