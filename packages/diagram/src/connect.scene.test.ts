import { describe, it, expect } from 'vitest';
import { createScene, type InvocationCtx, type Scene } from '@weasel-js/core';
import { commitEdgeToScene } from './connect';
import { DIAGRAM_EDGE, EDGE_DERIVE_PATH, diagramEdgeOf, withDiagramRegistry } from './edge';
import type { Port } from './types';

interface Data { diagram?: unknown }
interface Rect { x: number; y: number; width: number; height: number }

function sceneWithTwo(): Scene<Data, 'main', Rect> {
  const scene = createScene<Data, 'main', Rect>({ systemLayers: [{ id: 'main' }] });
  for (const [id, x] of [['a', 0], ['b', 300]] as const) {
    scene.add({
      id: id as never, kind: 'leaf', layer: 'main',
      pose: { x, y: 0, width: 100, height: 40 }, data: { diagram: {} },
    });
  }
  return scene;
}

const from: Port = { id: 'e', nodeId: 'a', point: { x: 100, y: 20 }, normal: { x: 1, y: 0 } };
const to: Port = { id: 'w', nodeId: 'b', point: { x: 300, y: 20 }, normal: { x: -1, y: 0 } };

describe('commitEdgeToScene', () => {
  it('adds an edge that names both ends and depends on both nodes', () => {
    const scene = sceneWithTwo();
    commitEdgeToScene(
      { from, to, router: 'orthogonal' },
      { deps: { scene } } as unknown as InvocationCtx,
    );
    const edges = scene.renderOrderNodes().filter((n) => n.dependsOn !== undefined);
    expect(edges).toHaveLength(1);
    expect(edges[0]!.dependsOn).toEqual(['a', 'b']);
    expect(diagramEdgeOf(edges[0]!)).toEqual({
      from: { port: 'e' }, to: { port: 'w' }, router: 'orthogonal',
    });
  });

  it('leaves the new edge undoable in one step', () => {
    const scene = sceneWithTwo();
    const before = scene.renderOrderNodes().length;
    commitEdgeToScene({ from, to, router: 'straight' }, { deps: { scene } } as unknown as InvocationCtx);
    expect(scene.renderOrderNodes()).toHaveLength(before + 1);
    expect(scene.undo()).toBe(true);
    expect(scene.renderOrderNodes()).toHaveLength(before);
  });

  it('does nothing at all without a scene dep', () => {
    expect(() => commitEdgeToScene(
      { from, to, router: 'straight' },
      { deps: {} } as unknown as InvocationCtx,
    )).not.toThrow();
  });

  it('puts the edge on the layer its source node is on', () => {
    const scene = createScene<Data, 'main' | 'wires', Rect>({
      systemLayers: [{ id: 'main' }, { id: 'wires' }],
    });
    for (const [id, x] of [['a', 0], ['b', 300]] as const) {
      scene.add({
        id: id as never, kind: 'leaf', layer: 'wires',
        pose: { x, y: 0, width: 100, height: 40 }, data: { diagram: {} },
      });
    }
    commitEdgeToScene({ from, to, router: 'straight' }, { deps: { scene } } as unknown as InvocationCtx);
    const edge = scene.renderOrderNodes().find((n) => n.dependsOn !== undefined)!;
    expect(edge.layer).toBe('wires');
  });

  it('gives the new edge a derivePath, so it paints', () => {
    // `dependsOn` alone makes an edge that re-resolves and draws nothing.
    const scene = sceneWithTwo();
    commitEdgeToScene({ from, to, router: 'straight' }, { deps: { scene } } as unknown as InvocationCtx);
    const edge = scene.renderOrderNodes().find((n) => n.dependsOn !== undefined)!;
    expect(edge.derivePath).toBe(EDGE_DERIVE_PATH);
  });

  it('round-trips the new edge through toJSON under its registry key', () => {
    // A function cannot be serialized, so the scene stores the key instead —
    // which it can only find through the registry the consumer wired.
    const scene = createScene<Data, 'main', Rect>({
      systemLayers: [{ id: 'main' }], registry: withDiagramRegistry<Rect>(),
    });
    for (const [id, x] of [['a', 0], ['b', 300]] as const) {
      scene.add({
        id: id as never, kind: 'leaf', layer: 'main',
        pose: { x, y: 0, width: 100, height: 40 }, data: { diagram: {} },
      });
    }
    commitEdgeToScene({ from, to, router: 'straight' }, { deps: { scene } } as unknown as InvocationCtx);
    const serialized = scene.toJSON().nodes.find((n) => n.dependsOn !== undefined)!;
    expect(serialized.derivePathKey).toBe(DIAGRAM_EDGE);
  });
});
