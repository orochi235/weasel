import { describe, it, expect } from 'vitest';
import { createPoseOverrides } from 'core/scene/poseOverrides';
import { moveAction } from './move';
import type { InvocationCtx, BindingOpts } from '../invoker';
import { createScene } from 'core/scene/scene';
import type { NodeId, PoseOverrides, Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';
import type { NodeAtPointDep } from '../depSchema';
import { buildDepsFromRequires } from '../buildDeps';
import type { DepRegistry } from '../depRegistry';
import { composeRectPose, decomposeRectPose } from 'features/groups/composePose';

/** Local-pose composition strategy. The reparentOnDrop tests below assert
 *  LOCAL rebasing (world pose → local under the new parent), so they supply
 *  this as the `poseComposition` dep. Without it the kit defaults to IDENTITY
 *  (absolute-pose) and the committed pose would stay in world coords. */
const LOCAL_PC = { compose: composeRectPose, decompose: decomposeRectPose };

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Minimal InvocationCtx with optional drag delta override. */
function makeCtx(
  overrides: {
    selectionIds?: string[];
    sceneNodes?: Record<string, { pose: unknown }>;
    drag?: { start: { x: number; y: number }; current: { x: number; y: number }; delta: { x: number; y: number } };
  } = {},
): InvocationCtx & { scene: StubScene } {
  const scene = makeStubScene(overrides.sceneNodes ?? {});
  const selection = makeStubSelection(overrides.selectionIds ?? []);
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection, scene },
    drag: overrides.drag,
    scene,
  } as InvocationCtx & { scene: StubScene };
}

// ---------------------------------------------------------------------------
// Stub scene
// ---------------------------------------------------------------------------

interface StubScene {
  poses: Map<string, unknown>;
  overrides: PoseOverrides<unknown>;
  batchLog: Array<{ label: string; ops: Array<{ id: string; pose: unknown }> }>;
  children: Map<string, NodeId[]>;
  get(id: NodeId): { pose: unknown } | undefined;
  setPose(id: NodeId, pose: unknown): void;
  batch<T>(label: string, fn: () => T): T;
  applyBatch(ops: unknown[], label: string, adapter: unknown): void;
  childrenOf(id: NodeId): readonly NodeId[];
}

function makeStubScene(
  initial: Record<string, { pose: unknown }>,
  childMap: Record<string, string[]> = {},
): StubScene {
  const poses = new Map<string, unknown>(
    Object.entries(initial).map(([id, { pose }]) => [id, pose]),
  );
  const batchLog: Array<{ label: string; ops: Array<{ id: string; pose: unknown }> }> = [];
  const children = new Map<string, NodeId[]>(
    Object.entries(childMap).map(([id, kids]) => [id, kids as NodeId[]]),
  );

  return {
    poses,
    batchLog,
    children,
    overrides: createPoseOverrides<unknown>((id) => (poses.has(id) ? { } : undefined)),
    childrenOf(id: NodeId): readonly NodeId[] {
      return children.get(id) ?? [];
    },
    get(id: NodeId) {
      if (!poses.has(id)) return undefined;
      return { pose: poses.get(id) };
    },
    setPose(id: NodeId, pose: unknown) {
      poses.set(id, pose);
    },
    batch<T>(label: string, fn: () => T): T {
      const ops: Array<{ id: string; pose: unknown }> = [];
      const prevSet = this.setPose.bind(this);
      const entry = { label, ops };
      batchLog.push(entry);
      // Intercept setPose calls inside the batch to record them.
      this.setPose = (id: NodeId, pose: unknown) => {
        ops.push({ id, pose });
        poses.set(id, pose);
      };
      const result = fn();
      this.setPose = prevSet;
      return result;
    },
    // The translate-only commit path now emits transform ops through
    // `commitOps` → `scene.applyBatch` (no consumer `applyOps`). Mirror the
    // real scene: record one undo entry and apply each op via an adapter that
    // writes the op's target pose to the scene.
    applyBatch(opList: unknown[], label: string) {
      const recorded: Array<{ id: string; pose: unknown }> = [];
      const adapter = {
        setPose(id: string, pose: unknown) {
          recorded.push({ id, pose });
          poses.set(id, pose);
        },
      };
      for (const op of opList as Array<{ apply(a: unknown): void }>) {
        op.apply(adapter);
      }
      batchLog.push({ label, ops: recorded });
    },
  };
}

// ---------------------------------------------------------------------------
// Stub selection
// ---------------------------------------------------------------------------

function makeStubSelection(ids: string[]) {
  return { get: () => ids as NodeId[] };
}

// ---------------------------------------------------------------------------
// Utility: unwrap invoker safely
// ---------------------------------------------------------------------------

function getOngoingInvoker(action: typeof moveAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('moveAction descriptor', () => {
  it('declares ongoing timing, drag defaultBinding, id and label', () => {
    expect(moveAction.id).toBe('move');
    expect(moveAction.label).toBe('Move');
    expect(moveAction.invoker?.timing).toBe('ongoing');
    expect(moveAction.defaultBinding).toEqual({ kind: 'drag', target: 'selected-body' });
  });

  it('start returns empty handle when selection is empty', () => {
    const invoker = getOngoingInvoker(moveAction);
    const ctx = makeCtx({ selectionIds: [] });
    const handle = invoker.start(ctx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns empty handle when selection dep is missing', () => {
    const invoker = getOngoingInvoker(moveAction);
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(ctx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns a handle with onMove and onEnd when selection is non-empty', () => {
    const invoker = getOngoingInvoker(moveAction);
    const ctx = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });
    const handle = invoker.start(ctx, undefined);
    expect(typeof handle.onMove).toBe('function');
    expect(typeof handle.onEnd).toBe('function');
  });

  it('onMove tracks delta without writing to scene', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });

    const handle = invoker.start(ctx as InvocationCtx, undefined);

    // Pose should not change after onMove — scene writes happen only at commit.
    const moveCtx: InvocationCtx = {
      ...ctx,
      drag: {
        start: { x: 0, y: 0 },
        current: { x: 30, y: 40 },
        delta: { x: 30, y: 40 },
      },
    };
    handle.onMove!(moveCtx);

    // Scene unchanged during drag.
    expect(scene.poses.get('a')).toEqual({ x: 10, y: 20, width: 50, height: 50 });
    expect(scene.batchLog).toHaveLength(0);
  });

  it('onEnd("commit") applies final delta via scene.batch and produces one undo entry', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a', 'b'],
      sceneNodes: {
        a: { pose: { x: 0, y: 0, width: 10, height: 10 } },
        b: { pose: { x: 100, y: 100, width: 20, height: 20 } },
      },
    });

    const handle = invoker.start(ctx as InvocationCtx, undefined);

    const moveCtx: InvocationCtx = {
      ...ctx,
      drag: {
        start: { x: 0, y: 0 },
        current: { x: 5, y: 7 },
        delta: { x: 5, y: 7 },
      },
    };
    handle.onMove!(moveCtx);
    handle.onEnd!(moveCtx, 'commit');

    // Both nodes should be translated.
    expect(scene.poses.get('a')).toEqual({ x: 5, y: 7, width: 10, height: 10 });
    expect(scene.poses.get('b')).toEqual({ x: 105, y: 107, width: 20, height: 20 });

    // Exactly one batch entry named 'Move'.
    expect(scene.batchLog).toHaveLength(1);
    expect(scene.batchLog[0].label).toBe('Move');
  });

  it('onEnd("commit") is a no-op when delta is zero (sub-threshold)', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 10, width: 10, height: 10 } } },
    });

    const handle = invoker.start(ctx as InvocationCtx, undefined);
    // No onMove call → delta stays {0, 0}.
    const endCtx: InvocationCtx = {
      ...ctx,
      drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 } },
    };
    handle.onEnd!(endCtx, 'commit');

    // No scene writes, no batch.
    expect(scene.poses.get('a')).toEqual({ x: 10, y: 10, width: 10, height: 10 });
    expect(scene.batchLog).toHaveLength(0);
  });

  it('onEnd("cancel") does not write to scene', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });

    const handle = invoker.start(ctx as InvocationCtx, undefined);

    const moveCtx: InvocationCtx = {
      ...ctx,
      drag: {
        start: { x: 0, y: 0 },
        current: { x: 99, y: 99 },
        delta: { x: 99, y: 99 },
      },
    };
    handle.onMove!(moveCtx);
    handle.onEnd!(moveCtx, 'cancel');

    // Scene unchanged — cancel is a no-op (scene was never mutated during drag).
    expect(scene.poses.get('a')).toEqual({ x: 10, y: 20, width: 50, height: 50 });
    expect(scene.batchLog).toHaveLength(0);
  });

  it('enabled returns true (invoker self-guards on empty selection)', () => {
    // The dispatcher's specificity-fallthrough loop treats anything `!== true`
    // as "skip this match" — returning a disabled reason here would silently
    // hand the move binding to lower-specificity ambient bindings (e.g.
    // insertAction's bare drag). See move.ts `enabled` JSDoc.
    expect(moveAction.enabled!()).toBe(true);
  });

  it('previewIds/previewPose expose in-flight buffered poses and clear on commit', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 10, y: 20, width: 50, height: 50 } } },
    });

    const handle = invoker.start(ctx as InvocationCtx, undefined);
    // No move yet → no preview ids.
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);

    const moveCtx: InvocationCtx = {
      ...ctx,
      drag: { start: { x: 0, y: 0 }, current: { x: 7, y: 3 }, delta: { x: 7, y: 3 } },
    };
    handle.onMove!(moveCtx);

    expect(Array.from(handle.previewIds!() ?? [])).toEqual(['a']);
    expect(handle.previewPose!('a')).toEqual({ x: 17, y: 23, width: 50, height: 50 });
    // Scene not yet mutated.
    expect(scene.poses.get('a')).toEqual({ x: 10, y: 20, width: 50, height: 50 });

    handle.onEnd!(moveCtx, 'commit');
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);
    expect(scene.poses.get('a')).toEqual({ x: 17, y: 23, width: 50, height: 50 });
  });

  it('cancel discards previews and leaves scene unchanged', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 0, y: 0, width: 10, height: 10 } } },
    });
    const handle = invoker.start(ctx as InvocationCtx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 0, y: 0 }, current: { x: 50, y: 50 }, delta: { x: 50, y: 50 } },
    } as InvocationCtx);
    expect(Array.from(handle.previewIds!() ?? []).length).toBe(1);
    handle.onEnd!(ctx as InvocationCtx, 'cancel');
    expect(Array.from(handle.previewIds!() ?? [])).toEqual([]);
    expect(scene.poses.get('a')).toEqual({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('cascades container descendants into preview state (container drag includes children)', () => {
    const invoker = getOngoingInvoker(moveAction);
    const scene = makeStubScene(
      {
        parent: { pose: { x: 0, y: 0, width: 100, height: 100 } },
        child: { pose: { x: 10, y: 10, width: 20, height: 20 } },
      },
      { parent: ['child'] },
    );
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { selection: makeStubSelection(['parent']), scene },
    };
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({
      ...ctx,
      drag: { start: { x: 0, y: 0 }, current: { x: 5, y: 5 }, delta: { x: 5, y: 5 } },
    });
    const ids = Array.from(handle.previewIds!() ?? []).sort();
    expect(ids).toEqual(['child', 'parent']);
    expect(handle.previewPose!('parent')).toMatchObject({ x: 5, y: 5 });
    expect(handle.previewPose!('child')).toMatchObject({ x: 15, y: 15 });

    handle.onEnd!(ctx, 'commit');
    // Both the parent (root) AND its cascaded child get rewritten — under
    // scene v1's absolute-pose semantics every node stores world coords
    // independently, so dragging a container must explicitly re-stamp
    // descendants by the same dx/dy. Without this they'd stay at their old
    // absolute positions and visually snap to the container's former parent.
    expect(scene.poses.get('parent')).toMatchObject({ x: 5, y: 5 });
    expect(scene.poses.get('child')).toEqual({ x: 15, y: 15, width: 20, height: 20 });
  });

  it('commit applies latest delta (multiple onMove calls, last one wins)', () => {
    const invoker = getOngoingInvoker(moveAction);
    const { scene, ...ctx } = makeCtx({
      selectionIds: ['a'],
      sceneNodes: { a: { pose: { x: 0, y: 0, width: 10, height: 10 } } },
    });

    const handle = invoker.start(ctx as InvocationCtx, undefined);

    // Simulate pointer moving across multiple frames.
    for (const delta of [{ x: 1, y: 1 }, { x: 5, y: 3 }, { x: 12, y: 8 }]) {
      handle.onMove!({
        ...ctx,
        drag: { start: { x: 0, y: 0 }, current: { x: delta.x, y: delta.y }, delta },
      } as InvocationCtx);
    }
    handle.onEnd!(
      { ...ctx, drag: { start: { x: 0, y: 0 }, current: { x: 12, y: 8 }, delta: { x: 12, y: 8 } } } as InvocationCtx,
      'commit',
    );

    // Final delta {12, 8} applied from origin {0,0}.
    expect(scene.poses.get('a')).toEqual({ x: 12, y: 8, width: 10, height: 10 });
    expect(scene.batchLog).toHaveLength(1);
    expect(scene.batchLog[0].label).toBe('Move');
  });
});

// ---------------------------------------------------------------------------
// Reparent-on-drop tests
//
// Use the real `createScene` so reparent paths exercise the actual layer /
// parent / index semantics rather than a stub. Each test builds a small
// scene (1 layer, a handful of nodes), wires a `nodeAtPoint` dep, and
// runs a synthetic drag → commit.
// ---------------------------------------------------------------------------

describe('moveAction — reparentOnDrop', () => {
  type Data = { kind: string };
  type Layer = 'main';
  type Pose = { x: number; y: number; width: number; height: number };

  function buildScene(): Scene<Data, Layer, Pose> {
    return createScene<Data, Layer, Pose>({
      systemLayers: [{ id: 'main' as Layer, visible: true, locked: false }],
    });
  }

  function runDrag(
    scene: Scene<Data, Layer, Pose>,
    selectionIds: string[],
    drop: { x: number; y: number },
    delta: { x: number; y: number },
    opts: BindingOpts | undefined,
    nodeAtPoint?: NodeAtPointDep,
  ): void {
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const selection = { get: () => selectionIds as NodeId[] };
    const baseCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection,
        scene: scene as Scene<unknown, string, unknown>,
        poseComposition: LOCAL_PC,
        ...(nodeAtPoint ? { nodeAtPoint } : {}),
      },
    };
    const handle = invoker.start(baseCtx as InvocationCtx, opts);
    handle.onMove!({
      ...baseCtx,
      drag: { start: { x: 0, y: 0 }, current: { x: delta.x, y: delta.y }, delta },
    } as InvocationCtx);
    handle.onEnd!(
      {
        ...baseCtx,
        world: drop,
        drag: { start: { x: 0, y: 0 }, current: { x: delta.x, y: delta.y }, delta },
      } as InvocationCtx,
      'commit',
    );
  }

  it('off (default) — preserves translate-only commit even when nodeAtPoint hits something', () => {
    const scene = buildScene();
    const movingId = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
    const targetId = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 100, width: 10, height: 10 }, data: { kind: 'rect' } });
    const nodeAtPoint: NodeAtPointDep = () => targetId;

    runDrag(scene, [movingId], { x: 105, y: 105 }, { x: 105, y: 105 }, undefined, nodeAtPoint);

    // Pose translated, parent unchanged.
    expect(scene.get(movingId)!.pose).toEqual({ x: 105, y: 105, width: 10, height: 10 });
    expect(scene.get(movingId)!.parent).toBeNull();
    expect(scene.get(targetId)!.parent).toBeNull();
  });

  it('top — drops onto a container, reparents under it at the end of children, world position preserved', () => {
    const scene = buildScene();
    const movingId = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
    // Container at world (50, 50). Existing child at local (5, 5) → world (55, 55).
    const containerId = scene.add({ kind: 'container', layer: 'main', pose: { x: 50, y: 50, width: 100, height: 100 }, data: { kind: 'group' } });
    const existingChildId = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 5, y: 5, width: 10, height: 10 }, data: { kind: 'rect' }, parent: containerId });
    const nodeAtPoint: NodeAtPointDep = () => containerId;

    runDrag(
      scene,
      [movingId],
      { x: 80, y: 80 },
      { x: 80, y: 80 },
      { params: { reparentOnDrop: 'top' } },
      nodeAtPoint,
    );

    // Now reparented under container.
    expect(scene.get(movingId)!.parent).toBe(containerId);
    // At the end of children (after the existing child).
    expect(scene.childrenOf(containerId)).toEqual([existingChildId, movingId]);
    // Local pose rebased: world (80, 80) under parent at world (50, 50) → local (30, 30).
    expect(scene.get(movingId)!.pose).toEqual({ x: 30, y: 30, width: 10, height: 10 });
  });

  it('above — drops onto a leaf sibling, lands at sibling index + 1 with same parent', () => {
    const scene = buildScene();
    const movingId = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
    // Three top-level siblings; drop onto the middle one.
    const aId = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 50, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
    const bId = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 100, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
    const cId = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 150, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });

    const nodeAtPoint: NodeAtPointDep = () => bId;

    runDrag(
      scene,
      [movingId],
      { x: 105, y: 5 },
      { x: 105, y: 5 },
      { params: { reparentOnDrop: 'above' } },
      nodeAtPoint,
    );

    // Above the hit sibling → between b and c.
    expect(scene.roots).toEqual([aId, bId, movingId, cId]);
    // World position preserved (no parent transform to rebase against).
    expect(scene.get(movingId)!.pose).toEqual({ x: 105, y: 5, width: 10, height: 10 });
  });

  it('top — drop on empty canvas (nodeAtPoint returns null) skips reparent, translate-only', () => {
    const scene = buildScene();
    const movingId = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
    const nodeAtPoint: NodeAtPointDep = () => null;

    runDrag(scene, [movingId], { x: 50, y: 50 }, { x: 50, y: 50 }, { params: { reparentOnDrop: 'top' } }, nodeAtPoint);

    expect(scene.get(movingId)!.parent).toBeNull();
    expect(scene.get(movingId)!.pose).toEqual({ x: 50, y: 50, width: 10, height: 10 });
  });

  it('excludes the moving node and its descendants from the hit-test', () => {
    const scene = buildScene();
    // Moving container with a child. Both must be excluded from the hit
    // candidate set, otherwise we'd cheerfully reparent the container
    // into itself or under its own descendant.
    const movingId = scene.add({ kind: 'container', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 100 }, data: { kind: 'group' } });
    const childId = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 10, y: 10, width: 10, height: 10 }, data: { kind: 'rect' }, parent: movingId });

    const calls: Array<{ excluded: NodeId[] }> = [];
    const nodeAtPoint: NodeAtPointDep = (_point, exclude) => {
      calls.push({ excluded: exclude ? Array.from(exclude) : [] });
      return null;
    };

    runDrag(scene, [movingId], { x: 50, y: 50 }, { x: 50, y: 50 }, { params: { reparentOnDrop: 'top' } }, nodeAtPoint);

    expect(calls).toHaveLength(1);
    expect(calls[0].excluded).toEqual(expect.arrayContaining([movingId, childId]));
  });

  it('cross-layer drop — switches layer and reparents under hit target', () => {
    const scene = createScene<{ kind: string }, 'a' | 'b', { x: number; y: number; width: number; height: number }>({
      systemLayers: [
        { id: 'a', visible: true, locked: false },
        { id: 'b', visible: true, locked: false },
      ],
    });
    const movingId = scene.add({ kind: 'leaf', layer: 'a', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
    const targetId = scene.add({ kind: 'container', layer: 'b', pose: { x: 100, y: 100, width: 50, height: 50 }, data: { kind: 'group' } });
    const nodeAtPoint: NodeAtPointDep = () => asNodeId(targetId);

    runDrag(
      scene as unknown as Scene<Data, Layer, Pose>,
      [movingId],
      { x: 120, y: 120 },
      { x: 120, y: 120 },
      { params: { reparentOnDrop: 'top' } },
      nodeAtPoint,
    );

    expect(scene.get(movingId)!.parent).toBe(targetId);
    expect(scene.get(movingId)!.layer).toBe('b');
    // World (120, 120) under parent at world (100, 100) → local (20, 20).
    expect(scene.get(movingId)!.pose).toEqual({ x: 20, y: 20, width: 10, height: 10 });
  });

  // End-to-end via the dispatcher's own dep builder. The other tests inject
  // `nodeAtPoint` into `ctx.deps` by hand, bypassing `buildDepsFromRequires` —
  // which only surfaces deps the action declared in `requires`. This test
  // builds the deps bag exactly the way the dispatcher does, so it fails if
  // `nodeAtPoint` is missing from `moveAction.requires` (the dep never reaches
  // the invoker and reparent-on-drop silently no-ops).
  it('reparentOnDrop fires when deps are built via buildDepsFromRequires (nodeAtPoint declared)', () => {
    const scene = buildScene();
    const movingId = scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });
    const containerId = scene.add({ kind: 'container', layer: 'main', pose: { x: 50, y: 50, width: 100, height: 100 }, data: { kind: 'group' } });
    const selection = { get: () => [movingId] as NodeId[] };
    const nodeAtPoint: NodeAtPointDep = () => asNodeId(containerId);

    // Stub registry mirroring the dispatcher's DepRegistry.get contract.
    const sources: Record<string, () => unknown> = {
      selection: () => selection,
      scene: () => scene as unknown as Scene<unknown, string, unknown>,
      poseComposition: () => LOCAL_PC,
      nodeAtPoint: () => nodeAtPoint,
    };
    const registry = {
      get: (name: string) => sources[name]?.(),
      register: () => () => {},
    } as unknown as DepRegistry;

    const deps = buildDepsFromRequires(moveAction, registry);
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const baseCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps,
    };
    const opts: BindingOpts = { params: { reparentOnDrop: 'top' } };
    const drag = { start: { x: 0, y: 0 }, current: { x: 105, y: 105 }, delta: { x: 105, y: 105 } };
    const handle = invoker.start(baseCtx as InvocationCtx, opts);
    handle.onMove!({ ...baseCtx, drag } as InvocationCtx);
    handle.onEnd!({ ...baseCtx, world: { x: 105, y: 105 }, drag } as InvocationCtx, 'commit');

    expect(scene.get(movingId)!.parent).toBe(containerId);
  });
});
