/**
 * Resize of a node whose pose is a polygon `Path`: a pose with no top-level
 * `x`/`y`/`width`/`height`, so anything reading it as bounds reads `undefined`.
 */
import { heldPose } from '../testUtils';
import { describe, it, expect } from 'vitest';
import { polygonFromPoints, type Path } from '@weasel-js/geom';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId, type Scene } from 'core/scene/types';
import { pathPoseDescriptor } from 'core/geometry/pathPoseDescriptor';
import type { InvocationCtx } from '@weasel-js/routing';
import type { GestureContext } from '../../gestures/types';
import type { SnapDep } from '../snapDep';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { resizeAction } from './action';

const ID = asNodeId('tri');

function makeScene(): Scene<unknown, string, unknown> {
  const scene = createScene<unknown, 'main', Path>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
  scene.add({
    id: ID,
    kind: 'mark',
    layer: 'main',
    data: {},
    // Bounds (10, 20) to (50, 40): 40 wide, 20 tall.
    pose: polygonFromPoints([{ x: 10, y: 20 }, { x: 50, y: 20 }, { x: 30, y: 40 }]),
  });
  return scene as unknown as Scene<unknown, string, unknown>;
}

function ctxAt(
  scene: Scene<unknown, string, unknown>,
  at: { x: number; y: number },
  extra: { shift?: boolean; deps?: Record<string, unknown> } = {},
): InvocationCtx {
  return {
    world: at,
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: extra.shift ?? false },
    deps: { selection: { get: () => [ID] as NodeId[] }, scene, ...extra.deps },
    drag: {
      start: { x: 50, y: 40 },
      current: at,
      delta: { x: at.x - 50, y: at.y - 40 },
      affordance: {
        kind: 'handle:bottom-right',
        targetIds: [ID as string],
        anchor: { x: 'min', y: 'min' },
      },
    },
  } as unknown as InvocationCtx;
}

function start(scene: Scene<unknown, string, unknown>, extra?: Parameters<typeof ctxAt>[2]) {
  const invoker = resizeAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  return invoker.start(ctxAt(scene, { x: 50, y: 40 }, extra), undefined);
}

function boundsOf(pose: unknown): Bounds {
  return pathPoseDescriptor.getBounds(pose as Path);
}

describe('resizeAction on a polygon path pose', () => {
  it('keeps the aspect ratio under Shift instead of writing NaN coords', () => {
    const scene = makeScene();
    const handle = start(scene, { shift: true });
    // Width is the dominant axis: 40 -> 80, so height follows 20 -> 40.
    handle.onMove!(ctxAt(scene, { x: 90, y: 45 }, { shift: true }));
    const preview = heldPose(scene, ID as string) as Path;
    const near = (b: Bounds) => {
      expect(b.x).toBeCloseTo(10);
      expect(b.y).toBeCloseTo(20);
      expect(b.width).toBeCloseTo(80);
      expect(b.height).toBeCloseTo(40);
    };
    near(boundsOf(preview));

    handle.onEnd!(ctxAt(scene, { x: 90, y: 45 }, { shift: true }), 'commit');
    near(boundsOf(scene.get(ID)!.pose));
  });

  it('hands constraints the bounds of the pose, at the start and as it moves', () => {
    const scene = makeScene();
    const seen: Array<{ origin: unknown; current: unknown }> = [];
    const spy = {
      onMove(ctx: GestureContext<Bounds>) {
        seen.push({ origin: ctx.origin.get(ID as string), current: ctx.current.get(ID as string) });
        return undefined;
      },
    };
    const policy = { constraints: [spy], expandIds: (ids: string[]) => ids };
    const handle = start(scene, { deps: { resizePolicy: policy } });
    handle.onMove!(ctxAt(scene, { x: 70, y: 40 }, { deps: { resizePolicy: policy } }));
    handle.onMove!(ctxAt(scene, { x: 90, y: 40 }, { deps: { resizePolicy: policy } }));

    expect(seen[0].origin).toMatchObject({ x: 10, y: 20, width: 40, height: 20 });
    expect(seen[1].current).toMatchObject({ x: 10, y: 20, width: 60, height: 20 });
  });

  it('snaps the path itself to where the snap session puts the dragged corner', () => {
    const scene = makeScene();
    const snap: SnapDep = {
      begin: () => ({
        at: () => ({ point: { x: 100, y: 60 }, held: true, marks: [] }),
        angle: (theta) => ({ theta, marks: [] }),
        end: () => {},
      }),
    };
    const handle = start(scene, { deps: { snap } });
    handle.onMove!(ctxAt(scene, { x: 90, y: 55 }, { deps: { snap } }));

    const preview = heldPose(scene, ID as string) as Path & Partial<Bounds>;
    expect(preview.kind).toBe('polygon');
    expect(preview.width).toBeUndefined();
    expect(boundsOf(preview)).toMatchObject({ x: 10, y: 20, width: 90, height: 40 });
  });
});
