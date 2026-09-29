import { describe, it, expect, vi } from 'vitest';
import { freeform } from './freeform';
import { nearestWithin } from '../snaps';

type P = { x: number; y: number; width: number; height: number };

const container = { id: 'C', bounds: { x: 0, y: 0, width: 100, height: 100 } };
const child = (id: string, x: number, y: number): { id: string; pose: P } => ({
  id,
  pose: { x, y, width: 10, height: 10 },
});

describe('freeform', () => {
  it('childPoses returns identity over stored poses', () => {
    const layout = freeform<P>();
    const children = [child('a', 5, 5), child('b', 30, 40)];
    const got = layout.childPoses(container, children);
    expect(got.get('a')).toEqual({ x: 5, y: 5, width: 10, height: 10 });
    expect(got.get('b')).toEqual({ x: 30, y: 40, width: 10, height: 10 });
    expect(got.size).toBe(2);
  });

  it('getDropTargets returns empty array (freeform never proposes targets)', () => {
    const layout = freeform<P>();
    const targets = layout.getDropTargets(
      container,
      [child('a', 5, 5)],
      {
        id: 'd',
        originPose: { x: 0, y: 0, width: 10, height: 10 },
        pose: { x: 0, y: 0, width: 10, height: 10 },
        sourceContainerId: null,
      },
    );
    expect(targets).toEqual([]);
  });

  it('reflowPoses returns an empty map (no sibling movement)', () => {
    const layout = freeform<P>();
    const reflow = layout.reflowPoses(
      container,
      [child('a', 5, 5)],
      {
        id: 'd',
        originPose: { x: 0, y: 0, width: 10, height: 10 },
        pose: { x: 0, y: 0, width: 10, height: 10 },
        sourceContainerId: null,
      },
      null,
    );
    expect(reflow.size).toBe(0);
  });

  it('commitDrop emits a transform op that writes dragged.pose and inverts to originPose', () => {
    const layout = freeform<P>();
    const ops = layout.commitDrop(
      container,
      [],
      {
        id: 'd',
        originPose: { x: 0, y: 0, width: 10, height: 10 },
        pose: { x: 12, y: 34, width: 10, height: 10 },
        sourceContainerId: null,
      },
      null,
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].label).toBe('Drop');

    const setPose = vi.fn<(id: string, pose: P) => void>();
    ops[0].apply({ setPose } as never);
    expect(setPose).toHaveBeenCalledWith('d', { x: 12, y: 34, width: 10, height: 10 });

    setPose.mockClear();
    const inverted = ops[0].invert!();
    inverted.apply({ setPose } as never);
    expect(setPose).toHaveBeenCalledWith('d', { x: 0, y: 0, width: 10, height: 10 });
  });

  it('commitDrop honors target.pose when present (snap-driven destination)', () => {
    const layout = freeform<P>();
    const ops = layout.commitDrop(
      container,
      [],
      {
        id: 'd',
        originPose: { x: 0, y: 0, width: 10, height: 10 },
        pose: { x: 50, y: 50, width: 10, height: 10 },
        sourceContainerId: null,
      },
      { pose: { x: 20, y: 20, width: 10, height: 10 }, origin: { x: 20, y: 20 } },
    );
    const setPose = vi.fn<(id: string, pose: P) => void>();
    ops[0].apply({ setPose } as never);
    expect(setPose).toHaveBeenCalledWith('d', { x: 20, y: 20, width: 10, height: 10 });
  });

  it('accepts a snap override', () => {
    const layout = freeform<P>({ snap: nearestWithin({ tolerance: 1 }) });
    expect(layout.snap.pickTarget([], { x: 0, y: 0 })).toBeNull();
  });
});
