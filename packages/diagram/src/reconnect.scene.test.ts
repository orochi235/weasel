import { describe, it, expect } from 'vitest';
import { createScene, type InvocationCtx, type Scene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH } from './edge';
import { diagramEdgeOf } from './edgeTrait';
import { commitReconnectToScene } from './reconnect';

interface Data { diagram?: unknown; stroke?: unknown }
interface Rect { x: number; y: number; width: number; height: number }

/** A, B and C, with edge `ab` from A's east port to B's west port. */
function sceneWithEdge(): Scene<Data, 'main', Rect> {
  const scene = createScene<Data, 'main', Rect>({ systemLayers: [{ id: 'main' }] });
  for (const [id, x, y] of [['A', 0, 0], ['B', 300, 0], ['C', 300, 200]] as const) {
    scene.add({
      id: id as never, kind: 'mark', layer: 'main',
      pose: { x, y, width: 100, height: 40 }, data: { diagram: {} },
    });
  }
  scene.add({
    id: 'ab' as never, kind: 'mark', layer: 'main',
    pose: { x: 0, y: 0, width: 0, height: 0 },
    data: { diagram: { from: { port: 'e' }, to: { port: 'w', laidOut: 'w' }, router: 'straight' }, stroke: { width: 2 } },
    dependsOn: ['A' as never, 'B' as never],
    derivePath: EDGE_DERIVE_PATH as never,
  });
  return scene;
}

const ctx = (scene: unknown) => ({ deps: { scene } }) as unknown as InvocationCtx;

function pathEnd(scene: Scene<Data, 'main', Rect>): number[] {
  const edge = scene.get('ab' as never)!;
  const deps = (edge.dependsOn as readonly string[]).map((id) => {
    const node = scene.get(id as never)!;
    return { node, pose: node.pose };
  });
  const path = EDGE_DERIVE_PATH(edge, deps as never) as { coords: Float32Array };
  return [...path.coords].slice(-2);
}

describe('commitReconnectToScene', () => {
  it('retargets the end and the dependency, and the path follows', () => {
    const scene = sceneWithEdge();
    commitReconnectToScene(
      { edgeId: 'ab', end: 'to', target: { kind: 'body', nodeId: 'C', point: { x: 350, y: 220 } } },
      ctx(scene),
    );
    const edge = scene.get('ab' as never)!;
    expect(edge.dependsOn).toEqual(['A', 'C']);
    expect(diagramEdgeOf(edge)!.to).toStrictEqual({});
    expect(diagramEdgeOf(edge)!.from).toStrictEqual({ port: 'e' });
    expect((edge.data as Data).stroke).toEqual({ width: 2 });
    // C's west side faces A's center more squarely than its north side does.
    expect(pathEnd(scene)).toEqual([300, 220]);
  });

  it('writes a port target as an end naming that port', () => {
    const scene = sceneWithEdge();
    commitReconnectToScene(
      { edgeId: 'ab', end: 'from', target: { id: 's', nodeId: 'C', point: { x: 350, y: 240 }, normal: { x: 0, y: 1 } } },
      ctx(scene),
    );
    const edge = scene.get('ab' as never)!;
    expect(edge.dependsOn).toEqual(['C', 'B']);
    expect(diagramEdgeOf(edge)!.from).toStrictEqual({ port: 's' });
  });

  it('undoes in one step, back to the old end and dependency exactly', () => {
    const scene = sceneWithEdge();
    commitReconnectToScene(
      { edgeId: 'ab', end: 'to', target: { kind: 'body', nodeId: 'C', point: { x: 350, y: 220 } } },
      ctx(scene),
    );
    expect(scene.undo()).toBe(true);
    const edge = scene.get('ab' as never)!;
    expect(edge.dependsOn).toEqual(['A', 'B']);
    expect(diagramEdgeOf(edge)!.to).toStrictEqual({ port: 'w', laidOut: 'w' });
    expect(pathEnd(scene)).toEqual([300, 20]);
  });

  it('does nothing without a scene dep, or for an id that is not an edge', () => {
    expect(() => commitReconnectToScene(
      { edgeId: 'ab', end: 'to', target: { kind: 'body', nodeId: 'C', point: { x: 0, y: 0 } } },
      ctx(undefined),
    )).not.toThrow();
    const scene = sceneWithEdge();
    commitReconnectToScene(
      { edgeId: 'A', end: 'to', target: { kind: 'body', nodeId: 'C', point: { x: 0, y: 0 } } },
      ctx(scene),
    );
    expect(scene.get('A' as never)!.dependsOn).toBeUndefined();
  });
});
