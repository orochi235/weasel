/**
 * Coverage for the four `resizePolicy` dep code paths in `resizeAction`:
 *
 *   1. `behaviors[]` — bounds-frame rewrite (test via `clampMinSize`).
 *   2. `pointSnap[]` — world-space anchor-point snap back-solve.
 *   3. `expandIds`   — group expansion of a single id into multiple leaves.
 *   4. `geometry`    — pose↔bounds projection through a non-identity
 *                       descriptor (rotation field passthrough via
 *                       `ROTATED_POSE_DESCRIPTOR`).
 *
 * Mirrors the helper shape from `resize.test.ts`: a stub scene with a
 * Map-backed pose store + a hand-rolled `InvocationCtx`. Behaviors are taken
 * from the kit's own library so the tests exercise the integration path
 * end-to-end rather than restating per-behavior math.
 */
import { describe, it, expect } from 'vitest';
import { resizeAction } from './resize';
import type { InvocationCtx } from '../invoker';
import type { NodeId } from 'core/scene/types';
import type {
  PointSnapBehavior,
  ResizeAnchor,
  BoundsConstraint,
  ResizePose,
  RotatedPose,
} from '../../gestures/types';
import type { PoseProjection } from '../resize/geometry';
import { ROTATED_POSE_DESCRIPTOR } from '../resize/geometry';
import { clampMinSize } from '../resize/behaviors/clampMinSize';
import { pointSnapToGrid } from '../resize/behaviors/pointSnapToGrid';

type RectPose = ResizePose;

const ANCHOR_BR: ResizeAnchor = { x: 'min', y: 'min' };

function makeStubScene(initial: Record<string, { pose: unknown }> = {}) {
  const poses = new Map<string, unknown>(
    Object.entries(initial).map(([id, { pose }]) => [id, pose]),
  );
  return {
    poses,
    get(id: NodeId) {
      if (!poses.has(id)) return undefined;
      return { pose: poses.get(id), kind: 'leaf' as const, layer: 'main', data: {}, parent: null };
    },
    setPose(id: NodeId, pose: unknown) { poses.set(id, pose); },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    batch<T>(_label: string, fn: () => T): T { return fn(); },
    // Mirrors the real no-journal scene.applyBatch: apply each op against the
    // commit adapter. resize's commit now routes through applyOps' fallback
    // (`scene.applyBatch(ops, 'Resize', defaultCommitAdapter(scene))`).
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
  deps?: Partial<InvocationCtx['deps']>;
}): InvocationCtx {
  const scene = makeStubScene(opts.sceneNodes);
  return {
    world: { x: opts.start.x, y: opts.start.y },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      selection: { get: () => opts.selectionIds as NodeId[] },
      scene,
      ...opts.deps,
    },
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

// ---------------------------------------------------------------------------
// 1. behaviors[] — clampMinSize prevents the bounds from going below a floor.
// ---------------------------------------------------------------------------

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
          constraints: [clampMinSize<RectPose>({ minWidth: 40, minHeight: 40 })] as BoundsConstraint<ResizePose>[],
          pointSnap: [],
          expandIds: (ids: string[]) => ids,
          projection: { getBounds: (p) => p, remapBounds: (_p, _s, d) => d } as PoseProjection<unknown>,
        },
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

    const preview = handle.previewPose!('a') as RectPose;
    expect(preview.width).toBeCloseTo(40);
    expect(preview.height).toBeCloseTo(40);
  });

  it('fires behavior onStart at gesture start', () => {
    const invoker = getOngoing(resizeAction);
    const onStart = vi_fn();
    const behavior: BoundsConstraint<ResizePose> = { onStart };
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 0, y: 0, width: 100, height: 100 } } },
      anchor: ANCHOR_BR,
      start: { x: 100, y: 100 },
      deps: {
        resizePolicy: {
          constraints: [behavior],
          pointSnap: [],
          expandIds: (ids: string[]) => ids,
          projection: { getBounds: (p: ResizePose) => p, remapBounds: (_p, _s, d) => d } as PoseProjection<unknown>,
        },
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
          pointSnap: [],
          expandIds: (ids: string[]) => ids,
          projection: { getBounds: (p: ResizePose) => p, remapBounds: (_p, _s, d) => d } as PoseProjection<unknown>,
        },
      },
    });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 150, y: 150 }, delta: { x: 50, y: 50 } },
    });
    handle.onEnd!(ctx, 'commit');
    const scene = ctx.deps.scene as ReturnType<typeof makeStubScene>;
    const pose = scene.poses.get('a') as RectPose;
    expect(pose.width).toBe(100);
    expect(pose.height).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 2. pointSnap[] — world-space grid snap back-solves the pose.
// ---------------------------------------------------------------------------

describe('resizeAction — pointSnap[] via resizePolicy dep', () => {
  it('snaps the dragged corner to a 20px grid', () => {
    const invoker = getOngoing(resizeAction);
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 0, y: 0, width: 100, height: 100 } } },
      anchor: ANCHOR_BR,
      start: { x: 100, y: 100 },
      deps: {
        resizePolicy: {
          constraints: [],
          pointSnap: [pointSnapToGrid({ spacing: 20 })] as PointSnapBehavior<ResizePose>[],
          expandIds: (ids: string[]) => ids,
          projection: { getBounds: (p: ResizePose) => p, remapBounds: (_p, _s, d) => d } as PoseProjection<unknown>,
        },
      },
    });
    const handle = invoker.start(ctx, undefined);
    // Drag to (133, 117) → dragged corner is the bottom-right at (133,117);
    // grid snap rounds it to (140, 120). Width/height back-solve from
    // fixed (0,0) → snapped (140,120): w=140, h=120.
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 133, y: 117 }, delta: { x: 33, y: 17 } },
    });
    const preview = handle.previewPose!('a') as RectPose;
    expect(preview.width).toBeCloseTo(140);
    expect(preview.height).toBeCloseTo(120);
  });
});

// ---------------------------------------------------------------------------
// 3. expandIds — group expansion writes per-leaf poses.
// ---------------------------------------------------------------------------

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
          pointSnap: [],
          // Map group id 'g' → leaf set.
          expandIds: (ids: string[]) => ids[0] === 'g' ? ['leaf1', 'leaf2'] : ids,
          projection: { getBounds: (p: ResizePose) => p, remapBounds: (pose: ResizePose, s: ResizePose, d: ResizePose) => {
            const sx = s.width === 0 ? 1 : d.width / s.width;
            const sy = s.height === 0 ? 1 : d.height / s.height;
            return {
              ...pose,
              x: d.x + (pose.x - s.x) * sx,
              y: d.y + (pose.y - s.y) * sy,
              width: pose.width * sx,
              height: pose.height * sy,
            } as ResizePose;
          } } as PoseProjection<unknown>,
        },
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
    const p1 = handle.previewPose!('leaf1') as RectPose;
    const p2 = handle.previewPose!('leaf2') as RectPose;
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
    const scene = ctx.deps.scene as ReturnType<typeof makeStubScene>;
    expect((scene.poses.get('leaf1') as RectPose).width).toBeCloseTo(100);
    expect((scene.poses.get('leaf2') as RectPose).width).toBeCloseTo(100);
    expect(scene.poses.get('g')).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });
});

// ---------------------------------------------------------------------------
// 4. geometry — non-identity descriptor (rotated pose passthrough).
// ---------------------------------------------------------------------------

describe('resizeAction — geometry via resizePolicy dep', () => {
  it('uses geometry.getBounds + remapBounds when projecting poses', () => {
    const invoker = getOngoing(resizeAction);
    const initial: RotatedPose = { x: 0, y: 0, width: 100, height: 100, rotation: 0 };
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: initial } },
      anchor: ANCHOR_BR,
      start: { x: 100, y: 100 },
      deps: {
        resizePolicy: {
          constraints: [],
          pointSnap: [],
          expandIds: (ids: string[]) => ids,
          // `ROTATED_POSE_DESCRIPTOR` preserves the `rotation` field on
          // `remapBounds` via `...p` spread; the proposed pose should still
          // carry rotation=0 (proves the descriptor was actually consulted).
          projection: ROTATED_POSE_DESCRIPTOR as PoseProjection<unknown>,
        },
      },
    });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 100, y: 100 }, current: { x: 120, y: 110 }, delta: { x: 20, y: 10 } },
    });
    const preview = handle.previewPose!('a') as RotatedPose;
    expect(preview.rotation).toBe(0);
    expect(preview.width).toBeCloseTo(120);
    expect(preview.height).toBeCloseTo(110);
  });

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
    const preview = handle.previewPose!('a') as RectPose;
    expect(preview.width).toBeCloseTo(150);
    expect(preview.height).toBeCloseTo(130);
  });
});

// ---------------------------------------------------------------------------
// Tiny test spy — Vitest's `vi.fn()` would do this, but a local one keeps
// the test self-contained and avoids a Vitest import widening.
// ---------------------------------------------------------------------------

function vi_fn() {
  const f = ((...args: unknown[]) => { f.calls.push(args); f.called = true; }) as ((...a: unknown[]) => void) & { calls: unknown[][]; called: boolean };
  f.calls = [];
  f.called = false;
  return f;
}

// ---------------------------------------------------------------------------
// 5. Group resize with a rotated child.
// ---------------------------------------------------------------------------

describe('resizeAction — a rotated leaf inside a group', () => {
  /** The naive projection: what the group path used for every leaf. */
  const naiveProjection = {
    getBounds: (p: ResizePose) => p,
    remapBounds: (pose: ResizePose, s: ResizePose, d: ResizePose) => {
      const sx = s.width === 0 ? 1 : d.width / s.width;
      const sy = s.height === 0 ? 1 : d.height / s.height;
      return {
        ...pose,
        x: d.x + (pose.x - s.x) * sx,
        y: d.y + (pose.y - s.y) * sy,
        width: pose.width * sx,
        height: pose.height * sy,
      } as ResizePose;
    },
  } as PoseProjection<unknown>;

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
          pointSnap: [],
          expandIds: (ids: string[]) => (ids[0] === 'g' ? ['upright', 'turned'] : ids),
          projection: naiveProjection,
        },
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
    const { handle } = dragGroup(
      { x: 40, y: 45, width: 20, height: 10, rotation: Math.PI / 2 },
      { x: 200, y: 100 },
    );
    const turned = handle.previewPose!('turned') as RotatedPose;
    expect(turned.height).toBeCloseTo(20);
    expect(turned.width).toBeCloseTo(20);
    expect(turned.rotation).toBeCloseTo(Math.PI / 2);
  });

  it('leaves the unrotated sibling on the plain affine', () => {
    const { handle } = dragGroup(
      { x: 40, y: 45, width: 20, height: 10, rotation: Math.PI / 2 },
      { x: 200, y: 100 },
    );
    const upright = handle.previewPose!('upright') as RectPose;
    expect(upright.width).toBeCloseTo(200);
    expect(upright.height).toBeCloseTo(100);
  });

  it('moves the rotated leaf\'s centre by the group affine', () => {
    const { handle } = dragGroup(
      { x: 40, y: 45, width: 20, height: 10, rotation: 0.6 },
      { x: 200, y: 100 },
    );
    const turned = handle.previewPose!('turned') as RotatedPose;
    // Centre was (50, 50) in a 100×100 union stretched 2× on x only.
    expect(turned.x + turned.width / 2).toBeCloseTo(100);
    expect(turned.y + turned.height / 2).toBeCloseTo(50);
  });

  it('still takes the naive affine for an unrotated leaf', () => {
    const { handle } = dragGroup(
      { x: 40, y: 45, width: 20, height: 10, rotation: 0 },
      { x: 200, y: 100 },
    );
    const turned = handle.previewPose!('turned') as RotatedPose;
    expect(turned.width).toBeCloseTo(40);
    expect(turned.height).toBeCloseTo(10);
  });

  it('commits the local-frame pose, not the naive one', () => {
    const { handle, ctx } = dragGroup(
      { x: 40, y: 45, width: 20, height: 10, rotation: Math.PI / 2 },
      { x: 200, y: 100 },
    );
    handle.onEnd!(ctx, 'commit');
    const scene = ctx.deps.scene as ReturnType<typeof makeStubScene>;
    const turned = scene.poses.get('turned') as RotatedPose;
    expect(turned.height).toBeCloseTo(20);
    expect(turned.width).toBeCloseTo(20);
  });
});
