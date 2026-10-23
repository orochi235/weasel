/**
 * Coverage for the `resizePolicy` dep code paths in `resizeAction`, plus the
 * `poseDescriptor` dep. Behaviors are taken from the kit's own library so the
 * tests exercise the integration path rather than restating per-behavior math.
 */
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composePose';
import { describe, it, expect } from 'vitest';
import { stubDeps, heldPose } from '../testUtils';
import { createPoseOverrides } from 'core/scene/poseOverrides';
import { resizeAction } from './action';
import type { InvocationCtx } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type {
  ResizeAnchor,
  BoundsConstraint,
  RotatedPose,
} from '../../gestures/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PoseDescriptor } from './geometry';
import { clampMinSize } from './behaviors/clampMinSize';
import { circle, CIRCLE_POSE_DESCRIPTOR } from 'core/geometry/circlePose.fixture';

type RectPose = Bounds;

const ANCHOR_BR: ResizeAnchor = { x: 'min', y: 'min' };

function makeStubScene(initial: Record<string, { pose: unknown }> = {}) {
  const poses = new Map<string, unknown>(
    Object.entries(initial).map(([id, { pose }]) => [id, pose]),
  );
  return {
    poses,
    overrides: createPoseOverrides<unknown>((id) => (poses.has(id) ? { } : undefined)),
    composition: IDENTITY_POSE_COMPOSITION,
    get(id: NodeId) {
      if (!poses.has(id)) return undefined;
      return { pose: poses.get(id), kind: 'mark' as const, layer: 'main', data: {}, parent: null };
    },
    childrenOf: (): readonly NodeId[] => [],
    setPose(id: NodeId, pose: unknown) { poses.set(id, pose); },
    batch<T>(_label: string, fn: () => T): T { return fn(); },
    // Mirrors the real no-journal scene.applyBatch: apply each op against the
    // commit adapter.
    applyBatch(ops: { apply: (a: unknown) => void }[], _label: string, adapter: unknown): void {
      for (const op of ops) op.apply(adapter);
    },
  };
}

function makeCtx(opts: {
  selectionIds: string[];
  sceneNodes: Record<string, { pose: unknown }>;
  anchor: ResizeAnchor;
  start: { x: number; y: number };
  deps?: Record<string, unknown>;
}): InvocationCtx {
  const scene = makeStubScene(opts.sceneNodes);
  return {
    world: { x: opts.start.x, y: opts.start.y },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: stubDeps({
      selection: { get: () => opts.selectionIds as NodeId[] },
      scene,
      ...opts.deps,
    }),
    drag: {
      start: opts.start,
      current: opts.start,
      delta: { x: 0, y: 0 },
      affordance: {
        kind: 'handle:bottom-right',
        fixedPoint: { x: 0, y: 0 },
        targetIds: opts.selectionIds,
        anchor: opts.anchor,
      },
    },
  };
}

function getOngoing(action: typeof resizeAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  return action.invoker;
}

describe('resizeAction — behaviors[] via resizePolicy dep', () => {
  it('applies clampMinSize to rewrite proposed bounds before commit', () => {
    const invoker = getOngoing(resizeAction);
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 0, y: 0, width: 100, height: 100 } } },
      anchor: ANCHOR_BR,
      start: { x: 100, y: 100 },
      deps: {
        resizePolicy: {
          constraints: [clampMinSize<RectPose>({ minWidth: 40, minHeight: 40 })] as BoundsConstraint<Bounds>[],
         
          expandIds: (ids: string[]) => ids,
        },
        poseDescriptor: { getBounds: (p) => p, remapBounds: (_p, _s, d) => d } as PoseDescriptor<unknown>,
      },
    });

    const handle = invoker.start(ctx, undefined);
    expect(handle.onMove).toBeDefined();

    // Drag the bottom-right corner far up-left → would shrink to 10×10
    // without the clamp. With clamp(40,40), bounds stop at 40×40.
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 10, y: 10 }, delta: { x: -90, y: -90 } },
    });

    const preview = heldPose(ctx.deps.scene, 'a') as RectPose;
    expect(preview.width).toBeCloseTo(40);
    expect(preview.height).toBeCloseTo(40);
  });

  it('fires behavior onStart at gesture start', () => {
    const invoker = getOngoing(resizeAction);
    const onStart = vi_fn();
    const behavior: BoundsConstraint<Bounds> = { onStart };
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 0, y: 0, width: 100, height: 100 } } },
      anchor: ANCHOR_BR,
      start: { x: 100, y: 100 },
      deps: {
        resizePolicy: {
          constraints: [behavior],
         
          expandIds: (ids: string[]) => ids,
        },
        poseDescriptor: { getBounds: (p: Bounds) => p, remapBounds: (_p, _s, d) => d } as PoseDescriptor<unknown>,
      },
    });
    invoker.start(ctx, undefined);
    expect(onStart.called).toBe(true);
  });

  it('behavior onEnd returning null aborts the commit (no scene write)', () => {
    const invoker = getOngoing(resizeAction);
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 0, y: 0, width: 100, height: 100 } } },
      anchor: ANCHOR_BR,
      start: { x: 100, y: 100 },
      deps: {
        resizePolicy: {
          constraints: [{ onEnd: () => null }],
         
          expandIds: (ids: string[]) => ids,
        },
        poseDescriptor: { getBounds: (p: Bounds) => p, remapBounds: (_p, _s, d) => d } as PoseDescriptor<unknown>,
      },
    });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 150, y: 150 }, delta: { x: 50, y: 50 } },
    });
    handle.onEnd!(ctx, 'commit');
    const scene = ctx.deps.scene as unknown as ReturnType<typeof makeStubScene>;
    const pose = scene.poses.get('a') as RectPose;
    expect(pose.width).toBe(100);
    expect(pose.height).toBe(100);
  });
});

describe('resizeAction — expandIds via resizePolicy dep', () => {
  it('takes the group path when expandIds returns a different id set', () => {
    const invoker = getOngoing(resizeAction);
    const ctx = makeCtx({
      selectionIds: ['g'],
      sceneNodes: {
        g: { pose: { x: 0, y: 0, width: 0, height: 0 } }, // present but unused
        leaf1: { pose: { x: 0, y: 0, width: 50, height: 50 } },
        leaf2: { pose: { x: 50, y: 50, width: 50, height: 50 } },
      },
      anchor: ANCHOR_BR,
      start: { x: 100, y: 100 },
      deps: {
        resizePolicy: {
          constraints: [],
         
          // Map group id 'g' → leaf set.
          expandIds: (ids: string[]) => ids[0] === 'g' ? ['leaf1', 'leaf2'] : ids,
        },
        poseDescriptor: { getBounds: (p: Bounds) => p, remapBounds: (pose: Bounds, s: Bounds, d: Bounds) => {
          const sx = s.width === 0 ? 1 : d.width / s.width;
          const sy = s.height === 0 ? 1 : d.height / s.height;
          return {
            ...pose,
            x: d.x + (pose.x - s.x) * sx,
            y: d.y + (pose.y - s.y) * sy,
            width: pose.width * sx,
            height: pose.height * sy,
          } as Bounds;
        } } as PoseDescriptor<unknown>,
      },
    });
    const handle = invoker.start(ctx, undefined);
    // Drag bottom-right corner by (+100, +100): union bounds 0×0..100×100
    // grows to 0×0..200×200 (2× in each axis). Each leaf scales 2×.
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 200, y: 200 }, delta: { x: 100, y: 100 } },
    });
    const previewIds = Array.from(handle.previewIds!() ?? []);
    expect(previewIds.sort()).toEqual(['leaf1', 'leaf2']);
    const p1 = heldPose(ctx.deps.scene, 'leaf1') as RectPose;
    const p2 = heldPose(ctx.deps.scene, 'leaf2') as RectPose;
    // leaf1 origin 0,0,50,50 → scale 2× → 0,0,100,100
    expect(p1.width).toBeCloseTo(100);
    expect(p1.height).toBeCloseTo(100);
    // leaf2 origin 50,50,50,50 → translated + scaled → 100,100,100,100
    expect(p2.x).toBeCloseTo(100);
    expect(p2.y).toBeCloseTo(100);
    expect(p2.width).toBeCloseTo(100);
    expect(p2.height).toBeCloseTo(100);

    // Commit writes both leaves; the original 'g' pose is untouched.
    handle.onEnd!(ctx, 'commit');
    const scene = ctx.deps.scene as unknown as ReturnType<typeof makeStubScene>;
    expect((scene.poses.get('leaf1') as RectPose).width).toBeCloseTo(100);
    expect((scene.poses.get('leaf2') as RectPose).width).toBeCloseTo(100);
    expect(scene.poses.get('g')).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

describe('resizeAction — geometry via poseDescriptor dep', () => {
  it('falls back to RECT_POSE_DESCRIPTOR identity when dep is absent', () => {
    const invoker = getOngoing(resizeAction);
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 0, y: 0, width: 100, height: 100 } } },
      anchor: ANCHOR_BR,
      start: { x: 100, y: 100 },
      // no resizePolicy dep — exercise the defaults path.
    });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 150, y: 130 }, delta: { x: 50, y: 30 } },
    });
    const preview = heldPose(ctx.deps.scene, 'a') as RectPose;
    expect(preview.width).toBeCloseTo(150);
    expect(preview.height).toBeCloseTo(130);
  });
});

describe('resizeAction — reads the poseDescriptor dep', () => {
  it('resizes a circle through its descriptor', () => {
    const invoker = getOngoing(resizeAction);
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: circle(50, 50, 50) } },
      anchor: ANCHOR_BR,
      start: { x: 100, y: 100 },
      deps: { poseDescriptor: CIRCLE_POSE_DESCRIPTOR as never },
    });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 100, y: 100 }, delta: { x: 0, y: 0 } },
    });
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 200, y: 200 }, delta: { x: 100, y: 100 } },
    });
    expect(heldPose(ctx.deps.scene, 'a')).toEqual(circle(100, 100, 100));
  });
});

function vi_fn() {
  const f = ((...args: unknown[]) => { f.calls.push(args); f.called = true; }) as ((...a: unknown[]) => void) & { calls: unknown[][]; called: boolean };
  f.calls = [];
  f.called = false;
  return f;
}

describe('resizeAction — a rotated leaf inside a group', () => {
  /** The naive projection: what the group path used for every leaf. */
  const naiveProjection = {
    getBounds: (p: Bounds) => p,
    remapBounds: (pose: Bounds, s: Bounds, d: Bounds) => {
      const sx = s.width === 0 ? 1 : d.width / s.width;
      const sy = s.height === 0 ? 1 : d.height / s.height;
      return {
        ...pose,
        x: d.x + (pose.x - s.x) * sx,
        y: d.y + (pose.y - s.y) * sy,
        width: pose.width * sx,
        height: pose.height * sy,
      } as Bounds;
    },
  } as PoseDescriptor<unknown>;

  function dragGroup(leafPose: RotatedPose, to: { x: number; y: number }) {
    const invoker = getOngoing(resizeAction);
    const ctx = makeCtx({
      selectionIds: ['g'],
      sceneNodes: {
        g: { pose: { x: 0, y: 0, width: 0, height: 0 } },
        upright: { pose: { x: 0, y: 0, width: 100, height: 100 } },
        turned: { pose: leafPose },
      },
      anchor: ANCHOR_BR,
      start: { x: 100, y: 100 },
      deps: {
        resizePolicy: {
          constraints: [],
         
          expandIds: (ids: string[]) => (ids[0] === 'g' ? ['upright', 'turned'] : ids),
        },
        poseDescriptor: naiveProjection,
      },
    });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: to, delta: { x: to.x - 100, y: to.y - 100 } },
    });
    return { handle, ctx };
  }

  it('scales a 90° leaf along its own axes, not the group\'s', () => {
    // Union is 0,0..100,100; dragging BR to (200, 100) doubles width only.
    // The leaf is 20×10 turned 90°, so its world-x extent is its height.
    const { ctx } = dragGroup(
      { x: 40, y: 45, width: 20, height: 10, rotation: Math.PI / 2 },
      { x: 200, y: 100 },
    );
    const turned = heldPose(ctx.deps.scene, 'turned') as RotatedPose;
    expect(turned.height).toBeCloseTo(20);
    expect(turned.width).toBeCloseTo(20);
    expect(turned.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('leaves the unrotated sibling on the plain affine', () => {
    const { ctx } = dragGroup(
      { x: 40, y: 45, width: 20, height: 10, rotation: Math.PI / 2 },
      { x: 200, y: 100 },
    );
    const upright = heldPose(ctx.deps.scene, 'upright') as RectPose;
    expect(upright.width).toBeCloseTo(200);
    expect(upright.height).toBeCloseTo(100);
  });

  it('moves the rotated leaf\'s centre by the group affine', () => {
    const { ctx } = dragGroup(
      { x: 40, y: 45, width: 20, height: 10, rotation: 0.6 },
      { x: 200, y: 100 },
    );
    const turned = heldPose(ctx.deps.scene, 'turned') as RotatedPose;
    // Centre was (50, 50) in a 100×100 union stretched 2× on x only.
    expect(turned.x + turned.width / 2).toBeCloseTo(100);
    expect(turned.y + turned.height / 2).toBeCloseTo(50);
  });

  it('still takes the naive affine for an unrotated leaf', () => {
    const { ctx } = dragGroup(
      { x: 40, y: 45, width: 20, height: 10, rotation: 0 },
      { x: 200, y: 100 },
    );
    const turned = heldPose(ctx.deps.scene, 'turned') as RotatedPose;
    expect(turned.width).toBeCloseTo(40);
    expect(turned.height).toBeCloseTo(10);
  });

  it('commits the local-frame pose, not the naive one', () => {
    const { handle, ctx } = dragGroup(
      { x: 40, y: 45, width: 20, height: 10, rotation: Math.PI / 2 },
      { x: 200, y: 100 },
    );
    handle.onEnd!(ctx, 'commit');
    const scene = ctx.deps.scene as unknown as ReturnType<typeof makeStubScene>;
    const turned = scene.poses.get('turned') as RotatedPose;
    expect(turned.height).toBeCloseTo(20);
    expect(turned.width).toBeCloseTo(20);
  });
});
