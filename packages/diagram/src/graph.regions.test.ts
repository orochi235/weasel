import { createScene, type Scene } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import type { DiagramSpec } from './dataTypes';
import { diagramScene } from './fromData';
import { buildGraph } from './graph';
import { layered } from './layered';
import { applyLayout } from './layoutAction';
import { sceneParticipants } from './portLayer';
import { withDiagramRegistry } from './edge';

interface Rect { x: number; y: number; width: number; height: number }

/** `src → m`, `m` inside container `box`, and `n` loose beside it. */
function sceneOf(): Scene<unknown, 'main', Rect> {
  const specs = diagramScene({
    nodes: [
      { id: 'src', lines: ['src'], at: { x: 600, y: 600 } },
      { id: 'm', lines: ['m'], at: { x: 40, y: 80 } },
      { id: 'n', lines: ['n'], at: { x: 900, y: 0 } },
    ],
    edges: [{ from: 'src', to: 'm' }, { from: 'm', to: 'n' }],
    containers: [{ id: 'box', role: 'container', label: 'Box', members: ['m'], box: { x: 0, y: 0, width: 300, height: 200 } }],
  }, { layout: 'none' });
  return createScene<unknown, 'main', Rect>({
    systemLayers: [{ id: 'main' }], initial: specs as DiagramSpec[] as never, registry: withDiagramRegistry() as never,
  });
}

const graphOf = (scene: Scene<unknown, 'main', Rect>) => buildGraph<Rect>(sceneParticipants(scene as never));

describe('buildGraph over containers', () => {
  it('lays a boxed container out as one node, its members inside it, and ranks edges against it', () => {
    const graph = graphOf(sceneOf());
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['box', 'n', 'src']);
    expect(graph.edges.map((e) => [e.from, e.to])).toEqual([['src', 'box'], ['box', 'n']]);
  });

  it('keeps a member inside its container through a layout run', () => {
    const scene = sceneOf();
    expect(applyLayout(scene, layered(graphOf(scene)))).toBeGreaterThan(0);
    const at = new Map(Array.from(sceneParticipants(scene as never)(), (p) => [p.node.id, p.pose as Rect]));
    const box = at.get('box')!, m = at.get('m')!;
    expect([m.x - box.x, m.y - box.y]).toEqual([40, 80]);
  });
});
