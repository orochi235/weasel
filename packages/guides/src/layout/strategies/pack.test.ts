import { describe, expect, it } from 'vitest';
import { createScene, type LayoutChild, type NodeId, type RectPose } from '@weasel-js/core';
import { pack } from './pack';

type P = RectPose;

const container = { id: 'C', bounds: { x: 10, y: 20, width: 100, height: 60 } };
const rect = (id: string, x: number, y: number, width: number, height: number): LayoutChild<P> => ({
  id,
  pose: { x, y, width, height },
});
const xy = (poses: Map<string, P>, ids: string[]) => ids.map((id) => [poses.get(id)!.x, poses.get(id)!.y]);

describe('pack', () => {
  const layout = pack<P>({ gap: 5 });

  it('shelves children in reading order, wrapping at the container width and keeping sizes', () => {
    const children = [rect('a', 0, 0, 40, 20), rect('b', 50, 0, 40, 30), rect('c', 0, 50, 40, 10)];
    const got = layout.childPoses(container, children);
    // a and b fill 85 of 100; c wraps under the taller of them.
    expect(xy(got, ['a', 'b', 'c'])).toEqual([[10, 20], [55, 20], [10, 55]]);
    expect(got.get('b')).toMatchObject({ width: 40, height: 30 });
  });

  it('is a fixed point of its own arrangement', () => {
    const children = [rect('a', 0, 0, 40, 20), rect('b', 50, 0, 40, 30), rect('c', 0, 50, 40, 10)];
    const once = layout.childPoses(container, children);
    const again = layout.childPoses(container, children.map((c) => ({ id: c.id, pose: once.get(c.id)! })));
    expect(again).toEqual(once);
  });

  it('offers a drop at every index and shifts the rest to make room', () => {
    const children = [rect('a', 10, 20, 40, 20), rect('b', 55, 20, 40, 20)];
    const dragged = {
      id: 'z', originPose: { x: 500, y: 500, width: 40, height: 20 },
      pose: { x: 12, y: 22, width: 40, height: 20 }, sourceContainerId: null,
    };
    const targets = layout.getDropTargets(container, children, dragged);
    expect(targets.map((t) => [t.pose.x, t.pose.y])).toEqual([[10, 20], [55, 20], [10, 45]]);
    const preview = layout.reflowPoses(container, children, dragged, targets[0]!);
    expect(xy(preview, ['a', 'b'])).toEqual([[55, 20], [10, 45]]);
    expect(layout.commitDrop(container, children, dragged, targets[0]!)).toHaveLength(3);
  });

  it('refuses what does not fit, by default', () => {
    const full = [rect('a', 10, 20, 100, 30), rect('b', 10, 55, 100, 25)];
    const extra = rect('c', 0, 0, 10, 10);
    expect(layout.arrive!(container, [...full, extra], new Set(['c']))).toBeNull();
    const wide = rect('w', 0, 0, 120, 10);
    expect(layout.arrive!(container, [wide], new Set(['w']))).toBeNull();
    const dragged = { id: 'c', originPose: extra.pose, pose: extra.pose, sourceContainerId: null };
    expect(layout.getDropTargets(container, full, dragged)).toEqual([]);
  });

  it('grows the container to its content and gives the height back', () => {
    const growing = pack<P>({ gap: 5, overflow: 'grow', minHeight: 30 });
    const full = [rect('a', 10, 20, 100, 30), rect('b', 10, 55, 100, 25)];
    const arrived = growing.arrive!(container, [...full, rect('c', 0, 300, 10, 10)], new Set(['c']))!;
    expect(arrived.poses.get('c')).toMatchObject({ x: 10, y: 85 });
    expect(arrived.bounds).toEqual({ x: 10, y: 20, width: 100, height: 75 });
    const left = growing.depart!(container, [full[0]!], new Set(['b']));
    expect(left.bounds).toEqual({ x: 10, y: 20, width: 100, height: 30 });
  });

  it('runs past the container when it scrolls, and reports the extent', () => {
    const scrolling = pack<P>({ gap: 5, overflow: 'scroll' });
    const children = [rect('a', 10, 20, 100, 30), rect('b', 10, 55, 100, 25), rect('c', 10, 85, 10, 10)];
    expect(scrolling.childPoses(container, children).get('c')).toMatchObject({ y: 85 });
    expect(scrolling.contentExtent!(container, children)).toEqual({ x: 10, y: 20, width: 100, height: 75 });
  });
});

describe('pack as a scene layout', () => {
  it('flows inserts and closes the gap a delete leaves', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const G = scene.add({
      kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 100, height: 100 },
      layout: pack<RectPose>(),
    });
    const leaf = (pose: RectPose) => scene.add({ kind: 'mark', layer: 'main', data: {}, pose, parent: G as NodeId });
    const a = leaf({ x: 0, y: 0, width: 60, height: 20 });
    const b = leaf({ x: 0, y: 50, width: 60, height: 10 });
    expect(scene.get(b)!.pose).toEqual({ x: 0, y: 20, width: 60, height: 10 });
    scene.remove(a);
    expect(scene.get(b)!.pose).toEqual({ x: 0, y: 0, width: 60, height: 10 });
    scene.undo();
    expect(scene.get(b)!.pose).toEqual({ x: 0, y: 20, width: 60, height: 10 });
  });
});
