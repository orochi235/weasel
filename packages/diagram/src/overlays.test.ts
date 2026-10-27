import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from './edge';
import { diagramScene, type DiagramSceneData } from './fromData';
import { worldRectOf } from './overlays';

describe('worldRectOf', () => {
  it('places a container\'s member in the world, not in the container\'s frame', () => {
    const specs = diagramScene({
      nodes: [{ id: 'm', lines: ['m'], width: 60, height: 40, at: { x: 60, y: 140 }, pinned: true }],
      edges: [],
      containers: [{ id: 'k', role: 'container', label: 'K', members: ['m'], box: { x: 40, y: 100, width: 200, height: 100 }, pinned: true }],
    }, { layout: 'none' });
    const scene = createScene<DiagramSceneData, 'main', RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry() });
    for (const spec of specs) scene.add(spec as never);
    expect(worldRectOf(scene, 'm')).toMatchObject({ x: 60, y: 140, width: 60, height: 40 });
  });
});
