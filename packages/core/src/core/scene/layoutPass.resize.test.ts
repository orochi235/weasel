import { describe, expect, it } from 'vitest';
import { createScene } from './scene';
import { asNodeId, type RectPose } from './types';
import type { LayoutStrategy } from '../../layout/types';

const base = {
  snap: { pickTarget: () => null },
  getDropTargets: () => [],
  reflowPoses: () => new Map(),
  commitDrop: () => [],
};

/** Children stacked top to bottom in child order, each keeping its own size. */
function stack(): LayoutStrategy<RectPose> {
  return {
    ...base,
    childPoses(container, children) {
      let y = container.bounds.y;
      return new Map(children.map((c) => {
        const pose = { ...c.pose, x: container.bounds.x, y };
        y += c.pose.height;
        return [c.id, pose];
      }));
    },
  };
}

/** A container 10 tall per child, which grows as children arrive. */
function grows(): LayoutStrategy<RectPose> {
  const place = (b: RectPose | { x: number; y: number }, i: number) => ({ x: b.x, y: b.y + i * 10, width: 10, height: 10 });
  return {
    ...base,
    childPoses: (container, children) => new Map(children.map((c, i) => [c.id, place(container.bounds, i)])),
    arrive: (container, children) => ({
      poses: new Map(children.map((c, i) => [c.id, place(container.bounds, i)])),
      bounds: { ...container.bounds, height: children.length * 10 },
    }),
  };
}

const id = asNodeId;

describe('layout pass resizing', () => {
  it('re-arranges the parent of a container its own arrive grew', () => {
    const scene = createScene<null, 'l', RectPose>({
      systemLayers: [{ id: 'l' }],
      initial: [
        { id: id('S'), kind: 'group', layer: 'l', pose: { x: 0, y: 0, width: 50, height: 200 }, data: null, layout: stack() },
        { id: id('A'), kind: 'group', layer: 'l', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null, parent: id('S'), layout: grows() },
        { id: id('a1'), kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null, parent: id('A') },
        { id: id('B'), kind: 'group', layer: 'l', pose: { x: 0, y: 10, width: 10, height: 10 }, data: null, parent: id('S') },
      ],
    });
    scene.add({ id: id('a2'), kind: 'mark', layer: 'l', pose: { x: 0, y: 0, width: 10, height: 10 }, data: null, parent: id('A') });
    expect(scene.get(id('A'))!.pose.height).toBe(20);
    expect(scene.get(id('B'))!.pose.y).toBe(20);
  });
});
