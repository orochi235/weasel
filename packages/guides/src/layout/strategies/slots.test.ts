import { describe, expect, it } from 'vitest';
import { createScene, type LayoutChild, type NodeId, type RectPose } from '@weasel-js/core';
import { gridSlots, ringSlots, rowSlots } from './arrangements';
import { slots } from './slots';

type P = { x: number; y: number; width: number; height: number };

const container = { id: 'C', bounds: { x: 0, y: 0, width: 300, height: 100 } };
const at = (id: string, cx: number, cy = 50): LayoutChild<P> => ({
  id,
  pose: { x: cx - 5, y: cy - 5, width: 10, height: 10 },
});
const centers = (poses: Map<string, P>, ids: string[]) =>
  ids.map((id) => {
    const p = poses.get(id)!;
    return [Math.round(p.x + p.width / 2), Math.round(p.y + p.height / 2)];
  });

describe('arrangements', () => {
  it('rowSlots spreads the count along the axis, centered across it', () => {
    expect(rowSlots()(container.bounds, 3).map((s) => [s.x, s.y])).toEqual([[50, 50], [150, 50], [250, 50]]);
    expect(rowSlots({ axis: 'y' })({ x: 0, y: 0, width: 40, height: 100 }, 2).map((s) => [s.x, s.y])).toEqual([
      [20, 25],
      [20, 75],
    ]);
  });

  it('rowSlots at a fixed pitch stays centered whatever the count', () => {
    expect(rowSlots({ pitch: 20 })(container.bounds, 3).map((s) => s.x)).toEqual([130, 150, 170]);
  });

  it('gridSlots adds a row when the last one fills', () => {
    const grid = gridSlots({ cols: 2 });
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    expect(grid(bounds, 2).map((s) => [s.x, s.y])).toEqual([[25, 50], [75, 50]]);
    expect(grid(bounds, 3).map((s) => [s.x, s.y])).toEqual([[25, 25], [75, 25], [25, 75]]);
  });

  it('ringSlots walks the ellipse inscribed in the bounds from the top', () => {
    const ring = ringSlots()({ x: 0, y: 0, width: 200, height: 100 }, 4);
    expect(ring.map((s) => [Math.round(s.x), Math.round(s.y)])).toEqual([[100, 0], [200, 50], [100, 100], [0, 50]]);
    expect(ring[1]!.angle).toBeCloseTo(0);
  });

  it('ringSlots over a partial sweep puts a slot on each end', () => {
    const arc = ringSlots({ start: Math.PI, sweep: Math.PI })({ x: 0, y: 0, width: 200, height: 200 }, 3);
    expect(arc.map((s) => [Math.round(s.x), Math.round(s.y)])).toEqual([[0, 100], [100, 0], [200, 100]]);
  });
});

describe('slots', () => {
  const layout = slots<P>({ arrangement: rowSlots() });

  it('gives each child a slot in the order they sit in, keeping their size', () => {
    const got = layout.childPoses(container, [at('b', 210), at('a', 20), at('c', 140)]);
    expect(centers(got, ['a', 'c', 'b'])).toEqual([[50, 50], [150, 50], [250, 50]]);
    expect(got.get('a')).toMatchObject({ width: 10, height: 10 });
  });

  it('offers a drag from inside every slot, and shifts the siblings between', () => {
    const children = [at('a', 50), at('b', 150), at('c', 250)];
    const dragged = { id: 'a', originPose: children[0]!.pose, pose: at('a', 240).pose, sourceContainerId: 'C' };
    const targets = layout.getDropTargets(container, children, dragged);
    expect(targets.map((t) => t.origin.x)).toEqual([50, 150, 250]);
    const preview = layout.reflowPoses(container, children, dragged, targets[2]!);
    expect(centers(preview, ['b', 'c'])).toEqual([[50, 50], [150, 50]]);
    expect(preview.has('a')).toBe(false);
    const ops = layout.commitDrop(container, children, dragged, targets[2]!);
    expect(ops).toHaveLength(3);
  });

  it('makes room for a drag from outside, at the slot it picks', () => {
    const children = [at('a', 75), at('b', 225)];
    const dragged = { id: 'z', originPose: at('z', 900).pose, pose: at('z', 140).pose, sourceContainerId: null };
    const targets = layout.getDropTargets(container, children, dragged);
    expect(targets.map((t) => t.origin.x)).toEqual([50, 150, 250]);
    const preview = layout.reflowPoses(container, children, dragged, targets[1]!);
    expect(centers(preview, ['a', 'b'])).toEqual([[50, 50], [250, 50]]);
    expect(targets[1]!.pose).toMatchObject({ x: 145, y: 45 });
  });

  it('places an arrival at the slot nearest where it was put, and leaves the order of the rest', () => {
    const children = [at('a', 75), at('b', 225), at('new', 160)];
    const got = layout.arrive!(container, children, new Set(['new']))!;
    expect(centers(got.poses, ['a', 'new', 'b'])).toEqual([[50, 50], [150, 50], [250, 50]]);
  });

  it('closes up in order when a child departs', () => {
    const children = [at('a', 50), at('c', 250)];
    const got = layout.depart!(container, children, new Set(['b']));
    expect(centers(got.poses, ['a', 'c'])).toEqual([[75, 50], [225, 50]]);
  });

  it('refuses arrivals and outside drops past the slots an arrangement offers', () => {
    const two = slots<P>({ arrangement: (bounds, count) => rowSlots()(bounds, Math.min(count, 2)) });
    const children = [at('a', 75), at('b', 225)];
    expect(two.arrive!(container, [...children, at('c', 10)], new Set(['c']))).toBeNull();
    const dragged = { id: 'z', originPose: at('z', 900).pose, pose: at('z', 140).pose, sourceContainerId: null };
    expect(two.getDropTargets(container, children, dragged)).toEqual([]);
  });

  it('hands a slot its angle through slotToPose', () => {
    type Spun = P & { rotation: number };
    const ring = slots<Spun>({
      arrangement: ringSlots(),
      slotToPose: (slot, pose) => ({ ...pose, x: slot.x, y: slot.y, rotation: slot.angle ?? 0 }),
    });
    const got = ring.childPoses({ id: 'R', bounds: { x: 0, y: 0, width: 100, height: 100 } }, [
      { id: 'a', pose: { x: 50, y: 0, width: 0, height: 0, rotation: 0 } },
      { id: 'b', pose: { x: 50, y: 100, width: 0, height: 0, rotation: 0 } },
    ]);
    expect(got.get('a')!.rotation).toBeCloseTo(-Math.PI / 2);
    expect(got.get('b')!.rotation).toBeCloseTo(Math.PI / 2);
  });
});

describe('slots as a scene layout', () => {
  const box = (cx: number, cy = 50): RectPose => ({ x: cx - 5, y: cy - 5, width: 10, height: 10 });

  it('re-spaces the row on insert and delete, each as one undo step', () => {
    const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const G = scene.add({
      kind: 'group', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 300, height: 100 },
      layout: slots<RectPose>({ arrangement: rowSlots() }),
    });
    const leaf = (pose: RectPose) => scene.add({ kind: 'mark', layer: 'main', data: {}, pose, parent: G as NodeId });
    const a = leaf(box(10));
    expect(scene.get(a)!.pose).toEqual(box(150));
    const b = leaf(box(290));
    expect(scene.get(a)!.pose).toEqual(box(75));
    expect(scene.get(b)!.pose).toEqual(box(225));
    scene.remove(a);
    expect(scene.get(b)!.pose).toEqual(box(150));
    scene.undo();
    expect(scene.get(a)!.pose).toEqual(box(75));
    expect(scene.get(b)!.pose).toEqual(box(225));
  });
});
