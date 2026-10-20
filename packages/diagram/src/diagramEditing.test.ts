import { describe, expect, it } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { removedData } from './diagramEditing';
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
