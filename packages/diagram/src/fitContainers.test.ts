import { createScene, type Scene } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { titleIdOf } from './containers/trait';
import type { DiagramData, DiagramSpec } from './dataTypes';
import { withDiagramRegistry } from './edge';
import { diagramScene } from './fromData';
import { buildGraph } from './graph';
import { applyLayout, layoutDiagram, layoutPoses } from './layoutAction';
import { sceneParticipants } from './portLayer';

interface Rect { x: number; y: number; width: number; height: number }

const node = (id: string) => ({ id, lines: [id], width: 60, height: 40 });

/** `a` fans out to `b` and `c`, both in fitted container `k`, which nests `j` around `c`; all meet at `d`. */
const DATA: DiagramData = {
  nodes: [node('a'), node('b'), node('c'), node('d'), node('e')],
  edges: [{ from: 'a', to: 'b' }, { from: 'a', to: 'c' }, { from: 'b', to: 'd' }, { from: 'c', to: 'd' }, { from: 'a', to: 'e' }],
  containers: [
    { id: 'k', role: 'container', label: 'K', members: ['b', 'j'] },
    { id: 'j', role: 'container', label: 'J', members: ['c'] },
  ],
};

function sceneOf(specs: readonly DiagramSpec[]): Scene<unknown, 'main', Rect> {
  return createScene<unknown, 'main', Rect>({
    systemLayers: [{ id: 'main' }], initial: specs as never, registry: withDiagramRegistry() as never,
  });
}

const worldOf = (scene: Scene<unknown, 'main', Rect>): Map<string, Rect> =>
  new Map(Array.from(sceneParticipants(scene as never)(), (p) => {
    const { x, y, width, height } = p.pose as Rect;
    return [p.node.id, { x, y, width, height }];
  }));

const expectBoxesClose = (got: Map<string, Rect>, want: Map<string, Rect>, ids: readonly string[]) => {
  for (const id of ids) {
    for (const k of ['x', 'y', 'width', 'height'] as const) expect(got.get(id)![k], `${id}.${k}`).toBeCloseTo(want.get(id)![k], 6);
  }
};

describe('a fitted container under a scene layout', () => {
  it('is a cluster around what it holds, not a participant', () => {
    const graph = buildGraph<Rect>(sceneParticipants(sceneOf(diagramScene(DATA, { layout: 'none' })) as never));
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(graph.clusters?.map((g) => [g.id, [...g.members].sort(), g.parent])).toEqual([
      ['k', ['b', 'c'], undefined], ['j', ['c'], 'k'],
    ]);
    expect(graph.node('b')!.cluster).toBe('k');
    expect(graph.node('c')!.cluster).toBe('j');
  });

  it('lays its members out the same way from diagramScene and from layoutDiagram on the scene it built', () => {
    const specs = diagramScene(DATA);
    const built = sceneOf(specs);
    const want = worldOf(built);
    // Unlaid, every node sits where diagramScene's own layout starts it.
    const scattered = sceneOf(diagramScene(DATA, { layout: 'none' }));
    layoutDiagram(scattered, sceneParticipants(scattered as never), 'layered', { layout: { order: 'barycenter' } });
    const ids = ['a', 'b', 'c', 'd', 'e', 'k', 'j'];
    const got = worldOf(scattered);
    const shift = { x: got.get('a')!.x - want.get('a')!.x, y: got.get('a')!.y - want.get('a')!.y };
    const moved = new Map([...want].map(([id, r]) => [id, { ...r, x: r.x + shift.x, y: r.y + shift.y }]));
    expectBoxesClose(got, moved, ids);
    expect(layoutDiagram(built, sceneParticipants(built as never), 'layered', { layout: { order: 'barycenter' } })).toBe(0);
    expectBoxesClose(worldOf(built), want, ids);
  });

  it('fits its box around a member a write moved, keeping the rest and its title in place', () => {
    const scene = sceneOf(diagramScene(DATA));
    const was = worldOf(scene);
    const b = was.get('b')!;
    applyLayout(scene, new Map([['b', { x: b.x - 200, y: b.y + 300 }]]));
    const now = worldOf(scene);
    expectBoxesClose(now, was, ['a', 'c', 'd', 'j']);
    const k = now.get('k')!;
    expect(k.x).toBeCloseTo(b.x - 200 - 12, 6);
    expect(k.y + k.height).toBeCloseTo(b.y + 300 + b.height + 12, 6);
    const title = scene.get(titleIdOf('k') as never)!.pose as Rect;
    expect([title.x, title.y, title.width]).toEqual([0, 0, k.width]);
    expect(scene.undo()).toBe(true);
    expectBoxesClose(worldOf(scene), was, ['b', 'c', 'k', 'j']);
  });

  it('keeps its frame while a gesture holds something in it', () => {
    const scene = sceneOf(diagramScene(DATA));
    const b = worldOf(scene).get('b')!;
    const poses = layoutPoses(scene, new Map([['c', { x: b.x, y: b.y + 400 }]]), undefined, (id) => id === 'b');
    expect(poses.has('j')).toBe(true);
    expect(poses.has('k')).toBe(false);
  });
});
