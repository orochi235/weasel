import { describe, expect, it } from 'vitest';
import { pointInPath, type Path } from '@weasel-js/geom';
import type { LayoutDragged, RectPose } from '@weasel-js/core';
import { laneStackLayout } from './laneStack';

const rows = laneStackLayout({ axis: 'y', headerSize: 30 });
const POOL = { id: 'p', bounds: { x: 0, y: 0, width: 330, height: 200 } };
const lane = (id: string, y: number, height: number): { id: string; pose: RectPose } =>
  ({ id, pose: { x: 30, y, width: 300, height } });
const A = lane('a', 0, 80);
const B = lane('b', 80, 120);

describe('laneStackLayout', () => {
  it('stacks lanes along the axis in the order they sit, stretched across the body', () => {
    const shuffled = [{ ...B, pose: { ...B.pose, x: 7, y: 0, width: 20 } }, { ...A, pose: { ...A.pose, y: 50 } }];
    const poses = rows.childPoses(POOL, shuffled);
    expect(poses.get('b')).toEqual({ x: 30, y: 0, width: 300, height: 120 });
    expect(poses.get('a')).toEqual({ x: 30, y: 120, width: 300, height: 80 });
  });

  it('has the last lane take up a change in the pool\'s size along the stack', () => {
    const poses = rows.childPoses({ ...POOL, bounds: { ...POOL.bounds, height: 260 } }, [A, B]);
    expect(poses.get('b')).toEqual({ x: 30, y: 80, width: 300, height: 180 });
  });

  it('puts the title up the left header', () => {
    const poses = rows.childPoses(POOL, [A, B, { id: 'p/title', pose: A.pose }]);
    expect(poses.get('p/title')!.rotation).toBeCloseTo(-Math.PI / 2);
  });

  it('takes drops past the header only', () => {
    const region = rows.dropRegion!(POOL) as Path;
    expect(pointInPath(region, 10, 50)).toBe(false);
    expect(pointInPath(region, 100, 50)).toBe(true);
  });

  it('offers a dragged lane each gap, and shifts the others to make room', () => {
    const dragged: LayoutDragged<RectPose> = { id: 'b', originPose: B.pose, pose: { ...B.pose, y: -40 }, sourceContainerId: 'p' };
    const targets = rows.getDropTargets(POOL, [A, B], dragged);
    expect(targets.map((t) => t.pose.y)).toEqual([0, 80]);
    const first = rows.snap.pickTarget(targets, { x: 100, y: 10 })!;
    expect(first.pose).toEqual({ x: 30, y: 0, width: 300, height: 120 });
    expect(rows.reflowPoses(POOL, [A, B], dragged, first).get('a')).toEqual({ x: 30, y: 120, width: 300, height: 80 });
    const ops = rows.commitDrop(POOL, [A, B], dragged, first);
    expect(ops.map((op) => (op.args as { id: string }).id).sort()).toEqual(['a', 'b']);
  });

  it('grows the pool to hold an arriving lane, and shrinks it when one leaves', () => {
    const C = { id: 'c', pose: { x: 500, y: 190, width: 10, height: 60 } };
    const grown = rows.arrive!(POOL, [A, B, C], new Set(['c']))!;
    expect(grown.bounds).toEqual({ x: 0, y: 0, width: 330, height: 260 });
    expect(grown.poses.get('c')).toEqual({ x: 30, y: 200, width: 300, height: 60 });
    const shrunk = rows.depart!(POOL, [B], new Set(['a']));
    expect(shrunk.bounds).toEqual({ x: 0, y: 0, width: 330, height: 120 });
    expect(shrunk.poses.get('b')).toEqual({ x: 30, y: 0, width: 300, height: 120 });
  });

  it('keeps a lane released outside every container home', () => {
    const dragged: LayoutDragged<RectPose> = { id: 'a', originPose: A.pose, pose: { ...A.pose, x: 900 }, sourceContainerId: 'p' };
    expect(rows.releaseDrop!(POOL, [B], dragged)).toEqual([]);
  });

  it('stacks columns along x under a top header', () => {
    const columns = laneStackLayout({ axis: 'x', headerSize: 30 });
    const pool = { id: 'q', bounds: { x: 0, y: 0, width: 200, height: 330 } };
    const poses = columns.childPoses(pool, [
      { id: 'a', pose: { x: 0, y: 30, width: 80, height: 300 } },
      { id: 'b', pose: { x: 80, y: 30, width: 120, height: 300 } },
    ]);
    expect(poses.get('b')).toEqual({ x: 80, y: 30, width: 120, height: 300 });
  });
});
