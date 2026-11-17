import { describe, expect, it } from 'vitest';
import { createScene, RIGID_POSE_COMPOSITION, worldPosesOf, type RectPose } from '@weasel-js/core';
import { removedData, resizeReports } from './diagramEditing';
import { withDiagramRegistry } from './edge';
import { diagramScene, edgeIdOf, type DiagramData, type DiagramSceneData } from './fromData';

const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'c', lines: ['c'] }],
  edges: [{ from: 'a', to: 'c' }, { from: 'b', to: 'c' }],
  containers: [
    { id: 'k', role: 'container', members: ['a'] },
    { id: 'p', role: 'pool', lanes: [{ id: 'l1', members: ['k'] }, { id: 'l2', members: ['b'] }] },
  ],
};

const sceneOf = (data: DiagramData) =>
  createScene<DiagramSceneData, 'main', RectPose>({ systemLayers: [{ id: 'main' }], initial: diagramScene(data, { layout: 'none' }), registry: withDiagramRegistry() });

describe('removedData', () => {
  it('takes a deleted pool with its lanes, every region and node inside them, and their edges', () => {
    const removed = removedData(sceneOf(DATA) as never, ['p']);
    expect([...removed.nodes].sort()).toEqual(['a', 'b', 'k', 'l1', 'l2', 'p']);
    expect([...removed.edges].sort()).toEqual([edgeIdOf({ from: 'a', to: 'c' }), edgeIdOf({ from: 'b', to: 'c' })].sort());
  });

  it('takes a deleted lane with what it holds, and leaves its pool', () => {
    const removed = removedData(sceneOf(DATA) as never, ['l2']);
    expect([...removed.nodes].sort()).toEqual(['b', 'l2']);
  });
});

describe('resizeReports', () => {
  it('reports a node and a region resized inside a lane at the world boxes they draw at', () => {
    const scene = sceneOf(DATA);
    const world = worldPosesOf(diagramScene(DATA, { layout: 'none' }), RIGID_POSE_COMPOSITION);
    const grown = (id: string) => ({ ...(scene.get(id as never)!.pose as RectPose), width: 200 });
    const { resizes, boxes } = resizeReports(scene as never, new Map([['a', grown('a')], ['k', grown('k')]]), new Set(['a', 'k']));
    const a = world.get('a') as RectPose;
    const k = world.get('k') as RectPose;
    expect(a.x === (scene.get('a' as never)!.pose as RectPose).x && a.y === (scene.get('a' as never)!.pose as RectPose).y).toBe(false);
    expect(resizes).toEqual([{ id: 'a', x: a.x, y: a.y, width: 200, height: a.height }]);
    expect(boxes).toEqual([{ kind: 'box', id: 'k', box: { x: k.x, y: k.y, width: 200, height: k.height } }]);
  });
});
