import { describe, expect, it } from 'vitest';
import { createScene } from '@weasel-js/core';
import { bakeGraphPoses, syncGraphPoses } from '../forceGraph/overrides';

type Layer = 'graph';
interface Data { group: number }
const R = 8;

function setup() {
  const scene = createScene<Data, Layer, { x: number; y: number; width: number; height: number }>({
    systemLayers: [{ id: 'graph' }],
  });
  const nodes = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 10, y: 10 },
  ];
  for (const n of nodes) {
    scene.add({
      id: n.id as never,
      kind: 'leaf',
      layer: 'graph',
      pose: { x: n.x - R, y: n.y - R, width: R * 2, height: R * 2 },
      data: { group: 0 },
    });
  }
  return { scene, nodes };
}

describe('forceGraph overrides', () => {
  it('writes no history and no version bump across a settle', () => {
    const { scene, nodes } = setup();
    const entries = scene.historyEntries().length;
    const version = scene.getVersion();

    for (let frame = 0; frame < 300; frame++) {
      nodes[0].x = frame;
      syncGraphPoses(scene, nodes, R);
    }

    expect(scene.historyEntries()).toHaveLength(entries);
    expect(scene.getVersion()).toBe(version);
  });

  it('allocates one pose buffer per node, not one per frame', () => {
    const { scene, nodes } = setup();
    syncGraphPoses(scene, nodes, R);
    const first = scene.overrides.get('a' as never)!.pose;
    syncGraphPoses(scene, nodes, R);
    expect(scene.overrides.get('a' as never)!.pose).toBe(first);
  });

  it('moves the rendered pose', () => {
    const { scene, nodes } = setup();
    nodes[0].x = 120;
    syncGraphPoses(scene, nodes, R);
    expect(scene.overrides.get('a' as never)!.pose).toEqual({
      x: 120 - R, y: -R, width: R * 2, height: R * 2,
    });
  });

  it('bakes the settled layout as one history entry and clears the overrides', () => {
    const { scene, nodes } = setup();
    const entries = scene.historyEntries().length;

    nodes[0].x = 55;
    syncGraphPoses(scene, nodes, R);
    bakeGraphPoses(scene, nodes, R);

    expect(scene.historyEntries()).toHaveLength(entries + 1);
    expect(scene.get('a' as never)!.pose).toEqual({
      x: 55 - R, y: -R, width: R * 2, height: R * 2,
    });
    expect(scene.overrides.ids()).toEqual([]);
  });
});
