/** A move hands its snap session's landing to the pose descriptor's translate, for the delta it came with only. */
import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingInvoker, SelectionApi } from '@weasel-js/routing';
import { IDENTITY_POSE_COMPOSITION, createScene, asNodeId, type Scene, RECT_POSE_DESCRIPTOR, type PoseDescriptor } from '@weasel-js/core/engine';
import type { SnapDep, MoveBehavior } from '@weasel-js/core/engine';
import { moveAction } from './action';

type Rect = { x: number; y: number; width: number; height: number };
const KEYS = { alt: false, ctrl: false, meta: false, shift: false };

/** Snaps the pointer to the integer grid and reports, as its landing, an x a host would store exactly. */
const snap: SnapDep = {
  begin: () => ({
    at: (p) => ({ point: { x: Math.round(p.x), y: Math.round(p.y) }, held: true, marks: [], landing: { x: 1 / 3 } }),
    angle: (theta) => ({ theta, marks: [] }),
    end: () => {},
  }),
};

/** RECT's descriptor, except that a landing puts the pose's x at the landing's. */
const landingDescriptor: PoseDescriptor<Rect> = {
  ...(RECT_POSE_DESCRIPTOR as PoseDescriptor<Rect>),
  translate(pose, dx, dy, lead, landing) {
    if (landing) return { ...pose, x: (landing as { x: number }).x, y: pose.y + dy };
    if (lead) return { ...pose, x: pose.x + (lead.to.x - lead.from.x), y: pose.y + (lead.to.y - lead.from.y) };
    return { ...pose, x: pose.x + dx, y: pose.y + dy };
  },
};

function drag(behaviors: MoveBehavior<unknown>[] = []) {
  const scene = createScene<object, 'main', Rect>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] }) as unknown as Scene<unknown, string, unknown>;
  const id = scene.add({ kind: 'mark', layer: 'main', data: {}, pose: { x: 0, y: 0, width: 10, height: 10 } }) as string;
  const deps = {
    scene, snap, poseDescriptor: landingDescriptor,
    operands: { get: () => [id], set: () => {} } as unknown as SelectionApi,
  };
  const start = { x: 5, y: 5 };
  const ctx = (p: { x: number; y: number }) => ({
    world: p, screen: p, modifiers: KEYS, deps,
    drag: { start, current: p, delta: { x: p.x - start.x, y: p.y - start.y } },
  }) as unknown as InvocationCtx;
  const handle = (moveAction.invoker as OngoingInvoker).start(ctx(start), behaviors.length ? { behaviors } : {});
  handle.onMove!(ctx({ x: 9.2, y: 7.9 }));
  handle.onEnd!(ctx({ x: 9.2, y: 7.9 }), 'commit');
  return scene.get(asNodeId(id))!.pose as Rect;
}

describe('a move with a snap landing', () => {
  it('stores what the descriptor makes of the landing', () => {
    expect(drag()).toMatchObject({ x: 1 / 3, y: 3 });
  });

  it('drops the landing once a behavior has moved the delta it came with', () => {
    const nudge: MoveBehavior<unknown> = {
      onMove: (_ctx, t: { kind: 'translate'; dx: number; dy: number }) => ({ transform: { ...t, dx: t.dx + 1 } }),
    } as MoveBehavior<unknown>;
    expect(drag([nudge])).toMatchObject({ x: 5, y: 3 });
  });
});
