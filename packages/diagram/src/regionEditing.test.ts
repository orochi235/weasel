import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from './edge';
import { diagramScene, type DiagramData, type DiagramSceneData } from './fromData';
import { laneResizeReports } from './regionEditing';

const DATA: DiagramData = {
  nodes: [{ id: 'b', lines: ['b'], width: 60, height: 40, at: { x: 100, y: 150 } }],
  edges: [],
  containers: [
    { id: 'k', role: 'container', box: { x: 300, y: 130, width: 100, height: 80 } },
    {
      id: 'p', role: 'pool', box: { x: 0, y: 0, width: 500, height: 240 }, pinned: true,
      lanes: [{ id: 'l1', size: 120 }, { id: 'l2', size: 120, members: ['b', 'k'] }],
    },
  ],
};

describe('laneResizeReports', () => {
  it('reports the lanes with the new size, and moves what the later lanes carry', () => {
    const scene = createScene<DiagramSceneData, 'main', RectPose>({
      systemLayers: [{ id: 'main' }], initial: diagramScene(DATA, { layout: 'none' }), registry: withDiagramRegistry(),
    });
    const out = laneResizeReports(scene as never, { poolId: 'p', laneId: 'l1', size: 150 })!;
    expect(out.lanes).toEqual({ kind: 'lanes', pool: 'p', lanes: [{ id: 'l1', size: 150 }, { id: 'l2', size: 120 }] });
    expect(out.moves).toEqual([{ id: 'b', x: 100, y: 180 }]);
    expect(out.boxes).toEqual([{ kind: 'box', id: 'k', box: { x: 300, y: 160, width: 100, height: 80 } }]);
  });
});
