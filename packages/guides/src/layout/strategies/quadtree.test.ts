import { describe, expect, it } from 'vitest';
import type { LayoutChild, RectPose } from '@weasel-js/core';
import { quadtree } from './quadtree';

type P = RectPose;

const container = { id: 'C', bounds: { x: 0, y: 0, width: 160, height: 160 } };
const rect = (id: string, x: number, y: number, size: number): LayoutChild<P> => ({
  id,
  pose: { x, y, width: size, height: size },
});
const dragOf = (id: string, pose: P) => ({ id, originPose: pose, pose, sourceContainerId: null });

describe('quadtree', () => {
  const layout = quadtree<P>({ maxDepth: 3 });

  it('centers each child in the smallest cell that holds it, where it sits', () => {
    // 60 fits an 80 cell (depth 1) and not a 40; 15 fits a 20 cell (depth 3).
    const got = layout.childPoses(container, [rect('big', 85, 5, 60), rect('small', 3, 3, 15)]);
    expect(got.get('big')).toEqual({ x: 90, y: 10, width: 60, height: 60 });
    expect(got.get('small')).toEqual({ x: 2.5, y: 2.5, width: 15, height: 15 });
  });

  it('is a fixed point of its own arrangement', () => {
    const children = [rect('big', 85, 5, 60), rect('small', 3, 3, 15), rect('mid', 10, 90, 35)];
    const once = layout.childPoses(container, children);
    const again = layout.childPoses(container, children.map((c) => ({ id: c.id, pose: once.get(c.id)! })));
    expect(again).toEqual(once);
  });

  it('moves a child whose cell a larger one covers to the nearest free cell of its size', () => {
    const got = layout.childPoses(container, [rect('big', 0, 0, 80), rect('small', 70, 30, 15)]);
    expect(got.get('big')).toEqual({ x: 0, y: 0, width: 80, height: 80 });
    // The 20-cell at column 4 is the first one clear of the big child's quadrant.
    expect(got.get('small')).toEqual({ x: 82.5, y: 22.5, width: 15, height: 15 });
  });

  it('offers a drag only the free cells of its own size', () => {
    const children = [rect('big', 0, 0, 80), rect('small', 82.5, 2.5, 15)];
    const targets = layout.getDropTargets(container, children, dragOf('z', { x: 0, y: 0, width: 70, height: 70 }));
    // Four quadrants: one holds `big`, one holds `small` deeper down.
    expect(targets.map((t) => t.hitBounds)).toEqual([
      { x: 0, y: 80, width: 80, height: 80 },
      { x: 80, y: 80, width: 80, height: 80 },
    ]);
    expect(targets[0]!.pose).toEqual({ x: 5, y: 85, width: 70, height: 70 });
  });

  it('does not count the dragged child against the cells it could take', () => {
    const children = [rect('a', 0, 0, 80)];
    const targets = layout.getDropTargets(container, children, {
      id: 'a', originPose: children[0]!.pose, pose: children[0]!.pose, sourceContainerId: 'C',
    });
    expect(targets).toHaveLength(4);
  });

  it('places an arrival in the free cell nearest where it was put, and refuses one with no room', () => {
    const one = quadtree<P>({ maxDepth: 1 });
    const held = [rect('a', 0, 0, 80), rect('b', 80, 0, 80), rect('c', 0, 80, 80)];
    const got = one.arrive!(container, [...held, rect('new', 0, 0, 80)], new Set(['new']))!;
    expect(got.poses.get('new')).toEqual({ x: 80, y: 80, width: 80, height: 80 });
    expect(got.poses.has('a')).toBe(false);
    const full = [...held, rect('d', 80, 80, 80)];
    expect(one.arrive!(container, [...full, rect('new', 0, 0, 80)], new Set(['new']))).toBeNull();
  });

  it('reports the cells its children hold, for a host that draws them', () => {
    const cells = layout.cells(container, [rect('big', 85, 5, 60), rect('small', 3, 3, 15)]);
    expect(cells).toEqual([
      { id: 'big', depth: 1, rect: { x: 80, y: 0, width: 80, height: 80 } },
      { id: 'small', depth: 3, rect: { x: 0, y: 0, width: 20, height: 20 } },
    ]);
  });
});
