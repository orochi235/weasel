import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { asNodeId, type RectPose } from './types';
import type { LayoutStrategy } from '../../layout/types';

/** Children stacked top to bottom in child order, each 10 tall and as wide as the container. */
function stack(): LayoutStrategy<RectPose> {
  return {
    snap: { pickTarget: () => null },
    childPoses(container, children) {
      return new Map(children.map((c, i) => [c.id, {
        x: container.bounds.x, y: container.bounds.y + i * 10, width: container.bounds.width, height: 10,
      }]));
    },
    getDropTargets: () => [],
    reflowPoses: () => new Map(),
    commitDrop: () => [],
  };
}

const id = asNodeId;

function makeScene() {
  return createScene<null, 'l', RectPose>({
    systemLayers: [{ id: 'l' }],
    initial: [
      { id: id('C'), kind: 'group', layer: 'l', pose: { x: 100, y: 100, width: 50, height: 200 }, data: null, layout: stack() },
      { id: id('K'), kind: 'group', layer: 'l', pose: { x: 0, y: 0, width: 50, height: 10 }, data: null, parent: id('C') },
      { id: id('m'), kind: 'mark', layer: 'l', pose: { x: 3, y: 4, width: 2, height: 2 }, data: null, parent: id('K') },
    ],
  });
}

describe('layout pass descendant carry', () => {
  it('leaves the children of a laid-out container\'s child to the frame that carries them', () => {
    const scene = makeScene();
    scene.add({ id: id('a'), kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 5, height: 5 }, data: null, parent: id('C'), index: 0 });
    expect(scene.get(id('K'))!.pose.y).toBe(10);
    expect(scene.get(id('m'))!.pose).toMatchObject({ x: 3, y: 4 });
    scene.undo();
    expect(scene.get(id('K'))!.pose.y).toBe(0);
  });
});
