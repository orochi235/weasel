import { describe, expect, it } from 'vitest';
import {
  PathBuilder, applyToPoint, transformPath, translate, worldCoords, type PolygonPath,
} from '@weasel-js/geom';
import type { DistortWarp } from '@weasel-js/geom/warp';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import {
  IDENTITY_POSE_COMPOSITION, asNodeId, commitOps, createScene, createTransformOp, type Scene,
} from '@weasel-js/core';
import { resolvePathWarp } from './pathWarp';
import { createWarpDragAction } from './warpActions';

type S = Scene<unknown, string, unknown>;

const FAR = 262_144;

const cornerOf = (w: DistortWarp, i: number): [number, number] => [w.corners[i].x, w.corners[i].y];

const depsOf = (scene: S) => ({
  scene,
  selection: { get: () => ['a'], set: () => {}, clear: () => {} },
}) as unknown as InvocationCtx['deps'];

describe('a warp on a polygon pose measured from an origin', () => {
  it('resolves where the origin puts the pose, before and after a move', () => {
    const square = new PathBuilder().setOrigin(FAR, 0)
      .moveTo(FAR, 0).lineTo(FAR + 100, 0).lineTo(FAR + 100, 100).lineTo(FAR, 100).close().build();
    const scene = createScene<unknown, 'main', unknown>({
      composition: IDENTITY_POSE_COMPOSITION,
      systemLayers: [{ id: 'main' }],
      initial: [{ id: asNodeId('a'), kind: 'mark', layer: 'main', pose: square, data: {} }],
    }) as unknown as S;
    const from = { x: FAR + 100, y: 100 }, to = { x: FAR + 125, y: 110 };
    const drag = (at: { x: number; y: number }) => ({
      start: from, current: at, delta: { x: at.x - from.x, y: at.y - from.y },
      affordance: { kind: 'layer:warp-distort', payload: { warpId: null, index: 2 } },
    });
    const ctx = (at: { x: number; y: number }): InvocationCtx => ({
      world: at, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps: depsOf(scene), drag: drag(at),
    });
    const handle = (createWarpDragAction('distort').invoker as OngoingInvoker).start(ctx(from), { params: {} });
    handle.onMove?.(ctx(to));
    handle.onEnd?.(ctx(to), 'commit');
    const warped = scene.get(asNodeId('a'))!.pose as PolygonPath;
    expect(worldCoords(warped)[4]).toBeCloseTo(FAR + 125, 3);
    expect(resolvePathWarp(scene.get(asNodeId('a')))).not.toBeNull();

    const moved = transformPath(warped, translate(30, 0));
    commitOps(depsOf(scene), [createTransformOp({ id: asNodeId('a'), from: warped, to: moved, label: 'Move' })], 'Move');
    const resolved = resolvePathWarp(scene.get(asNodeId('a')))!;
    expect(resolved).not.toBeNull();
    // The dragged corner's handle moved with the pose.
    const [x, y] = applyToPoint(resolved.toWorld, ...cornerOf(resolved.held.warp as DistortWarp, 2));
    expect(x).toBeCloseTo(FAR + 155, 2);
    expect(y).toBeCloseTo(110, 2);
  });
});
