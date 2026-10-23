import { describe, expect, it } from 'vitest';
import { asNodeId, type DerivedDep, type RectPose } from '@weasel-js/core';
import { edgeDerivePath, orthogonal } from './edge';
import { selfLoop } from './selfLoop';
import type { Port } from './types';

const port = (id: string, x: number, y: number, normal: Port['normal']): Port =>
  ({ id, nodeId: 'n', point: { x, y }, normal });

// A 40 by 40 box at the origin: its side midpoints, facing out.
const SIDES: Port[] = [
  port('n', 20, 0, { x: 0, y: -1 }),
  port('e', 40, 20, { x: 1, y: 0 }),
  port('s', 20, 40, { x: 0, y: 1 }),
  port('w', 0, 20, { x: -1, y: 0 }),
];

describe('selfLoop', () => {
  it('leaves by one side, returns by the next, and passes the corner between them', () => {
    const loop = selfLoop(SIDES, 20)!;
    expect([loop.from.id, loop.to.id]).toEqual(['e', 'n']);
    expect(loop.via).toEqual({ x: 60, y: -20 });
  });

  it('follows the node when it is turned', () => {
    // The same box a quarter turn clockwise: the port named `n` now faces east.
    const turned = [
      port('n', 40, 20, { x: 1, y: 0 }),
      port('e', 20, 40, { x: 0, y: 1 }),
      port('s', 0, 20, { x: -1, y: 0 }),
      port('w', 20, 0, { x: 0, y: -1 }),
    ];
    const loop = selfLoop(turned, 10)!;
    expect([loop.from.id, loop.to.id]).toEqual(['n', 'w']);
    expect(loop.via).toEqual({ x: 50, y: -10 });
  });

  it('has no answer without two sides that face different ways', () => {
    expect(selfLoop([SIDES[1]!], 20)).toBeNull();
    expect(selfLoop([SIDES[1]!, port('e2', 40, 30, { x: 1, y: 0 })], 20)).toBeNull();
    expect(selfLoop([port('a', 0, 0, null), port('b', 40, 40, null)], 20)).toBeNull();
  });
});

describe('a self-edge with no named ports', () => {
  const pose: RectPose = { x: 0, y: 0, width: 40, height: 40 };
  const dep: DerivedDep<RectPose> = {
    node: { id: asNodeId('n'), kind: 'mark', layer: 'main', parent: null, pose, data: { diagram: {} } } as never,
    pose,
    path: null,
  };
  const derive = edgeDerivePath<RectPose>();
  const points = (edge: object): Array<[number, number]> => {
    const { coords } = derive({ data: { diagram: { from: {}, to: {}, ...edge } } }, [dep, dep]) as { coords: Float32Array };
    return Array.from({ length: coords.length / 2 }, (_, i) => [coords[2 * i]!, coords[2 * i + 1]!]);
  };
  const inside = ([x, y]: [number, number]): boolean => x > 0 && x < 40 && y > 0 && y < 40;

  it('draws a straight route out past the corner and back', () => {
    expect(points({})).toEqual([[40, 20], [60, -20], [20, 0]]);
  });

  it('stands off by the distance asked for', () => {
    const near = edgeDerivePath<RectPose>({ selfLoopStandoff: 8 });
    const { coords } = near({ data: { diagram: { from: {}, to: {} } } }, [dep, dep]) as { coords: Float32Array };
    expect([...coords].slice(2, 4)).toEqual([48, -8]);
  });

  it('draws an orthogonal route around the corner, never doubling back', () => {
    expect(points({ router: 'orthogonal' })).toEqual([[40, 20], [60, 20], [60, -20], [20, -20], [20, 0]]);
  });

  it('draws a curve that leaves, passes the corner, and returns outside the node', () => {
    const pts = points({ router: 'bezier' });
    expect(pts[0]).toEqual([40, 20]);
    expect(pts.at(-1)).toEqual([20, 0]);
    expect(pts).toContainEqual([60, -20]);
    expect(pts.some(inside)).toBe(false);
  });

  it('routes through the author\'s waypoints instead of the corner', () => {
    expect(points({ waypoints: [{ x: 90, y: 20 }] })).toEqual([[40, 20], [90, 20], [20, 0]]);
  });

  it('leaves an edge between two named ports as it was', () => {
    expect(points({ from: { port: 'e' }, to: { port: 'w' } })).toEqual([[40, 20], [0, 20]]);
  });
});

describe('orthogonal', () => {
  it('turns at a waypoint rather than doubling back to split the last leg', () => {
    const pts = orthogonal({
      from: port('a', 0, 100, { x: 1, y: 0 }),
      to: port('b', -50, 0, { x: 0, y: -1 }),
      waypoints: [{ x: 50, y: -40 }],
    });
    expect(pts).toEqual([{ x: 0, y: 100 }, { x: 50, y: 100 }, { x: 50, y: -40 }, { x: -50, y: -40 }, { x: -50, y: 0 }]);
  });
});
