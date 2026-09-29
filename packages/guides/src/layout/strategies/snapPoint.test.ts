import { describe, it, expect } from 'vitest';
import { snapPoint } from './snapPoint';
import { nearest } from '../snaps';

type P = { x: number; y: number };

const container = { id: 'C', bounds: { x: 0, y: 0, width: 100, height: 100 } };
const dragged = (pose: P) => ({
  id: 'd',
  originPose: { x: 0, y: 0 } as P,
  pose,
  sourceContainerId: null as string | null,
});

describe('snapPoint', () => {
  it('childPoses returns identity', () => {
    const layout = snapPoint<P>({ pattern: 'corners' });
    const children = [{ id: 'a', pose: { x: 5, y: 5 } as P }];
    const got = layout.childPoses(container, children);
    expect(got.get('a')).toEqual({ x: 5, y: 5 });
  });

  it('corners pattern emits four targets at the container corners', () => {
    const layout = snapPoint<P>({ pattern: 'corners' });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    const origins = targets.map((t) => t.origin);
    expect(origins).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 },
      ]),
    );
    expect(targets).toHaveLength(4);
  });

  it('edges pattern emits four edge midpoints', () => {
    const layout = snapPoint<P>({ pattern: 'edges' });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    const origins = targets.map((t) => t.origin);
    expect(origins).toEqual(
      expect.arrayContaining([
        { x: 50, y: 0 },
        { x: 50, y: 100 },
        { x: 0, y: 50 },
        { x: 100, y: 50 },
      ]),
    );
    expect(targets).toHaveLength(4);
  });

  it('center pattern emits a single center target', () => {
    const layout = snapPoint<P>({ pattern: 'center' });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    expect(targets).toHaveLength(1);
    expect(targets[0].origin).toEqual({ x: 50, y: 50 });
  });

  it('grid pattern emits a regular grid of points', () => {
    const layout = snapPoint<P>({ pattern: 'grid', gridSpacing: 50 });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    // Spacing 50 in 100x100 container → x ∈ {0, 50, 100}, y ∈ {0, 50, 100} = 9 points.
    expect(targets).toHaveLength(9);
  });

  it('grid pattern with non-divisible spacing floors to the last in-bounds step', () => {
    const layout = snapPoint<P>({ pattern: 'grid', gridSpacing: 30 });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    // Spacing 30 in 100x100 container → x ∈ {0, 30, 60, 90}, same for y = 16 points.
    expect(targets).toHaveLength(16);
    const origins = targets.map((t) => t.origin);
    expect(origins).toEqual(
      expect.arrayContaining([
        { x: 0, y: 0 },
        { x: 90, y: 0 },
        { x: 0, y: 90 },
        { x: 90, y: 90 },
      ]),
    );
  });

  it('reflowPoses returns empty map', () => {
    const layout = snapPoint<P>({ pattern: 'center' });
    const reflow = layout.reflowPoses(container, [], dragged({ x: 0, y: 0 }), null);
    expect(reflow.size).toBe(0);
  });

  it('commitDrop emits a single transform op at the target origin when target is non-null', () => {
    const layout = snapPoint<P>({ pattern: 'center' });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    const ops = layout.commitDrop(container, [], dragged({ x: 30, y: 30 }), targets[0]);
    expect(ops).toHaveLength(1);
    expect(ops[0].label).toBe('Snap drop');
    expect(typeof ops[0].apply).toBe('function');
    expect(typeof ops[0].invert).toBe('function');
  });

  it('commitDrop with null target emits free-space drop', () => {
    const layout = snapPoint<P>({ pattern: 'corners' });
    const ops = layout.commitDrop(container, [], dragged({ x: 30, y: 30 }), null);
    expect(ops).toHaveLength(1);
  });

  it('default snap is nearestWithin with the configured tolerance', () => {
    const layout = snapPoint<P>({ pattern: 'corners', tolerance: 5 });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    expect(layout.snap.pickTarget(targets, { x: 2, y: 2 })?.origin).toEqual({ x: 0, y: 0 });
    expect(layout.snap.pickTarget(targets, { x: 50, y: 50 })).toBeNull();
  });

  it('accepts a snap override', () => {
    const layout = snapPoint<P>({ pattern: 'corners', snap: nearest<P>() });
    const targets = layout.getDropTargets(container, [], dragged({ x: 0, y: 0 }));
    // nearest never returns null when targets non-empty.
    expect(layout.snap.pickTarget(targets, { x: 50, y: 50 })).not.toBeNull();
  });
});
