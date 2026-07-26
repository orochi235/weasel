import { describe, it, expect } from 'vitest';
import { moveAction } from './move';
import type { InvocationCtx } from '../invoker';
import { tileGrid } from '../../../layout/strategies';
import type { LayoutDep } from '../depSchema';
import type { NodeId } from 'core/scene/types';
import { composeRectPose, decomposeRectPose } from 'features/groups/composePose';
import { PATH_M, PATH_L, PATH_Z, type PolygonPath } from 'features/paths/types';

/** Axis-aligned square as a PolygonPath — a container pose that carries NO
 *  direct `x/y/width/height`, so the layout hit-test must derive its AABB via
 *  the pose descriptor rather than casting to a rect. */
function squarePolygon(x: number, y: number, w: number, h: number): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
    coords: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
    fillRule: 'nonzero',
  };
}

/** Local-pose composition strategy (parent translation). Supplied as the
 *  `poseComposition` dep so the existing tests below keep exercising the
 *  local-pose model. Omitting it falls back to the kit's IDENTITY default
 *  (absolute-pose), exercised by the dedicated absolute-model test. */
const LOCAL_PC = { compose: composeRectPose, decompose: decomposeRectPose };

type P = { x: number; y: number; width: number; height: number };

interface AppliedBatch {
  ops: { name?: string; id?: string; label?: string; args?: { id?: string; toParentId?: string | null; to?: P } }[];
  label: string;
}

interface StubScene {
  poses: Map<string, P>;
  childMap: Map<string, NodeId[]>;
  roots: NodeId[];
  appliedBatches: AppliedBatch[];
  get(id: NodeId): { pose: P; parent: NodeId | null } | undefined;
  childrenOf(id: NodeId): readonly NodeId[];
  applyBatch(ops: unknown[], label: string, adapter: unknown): void;
  batch(label: string, fn: () => void): void;
  setPose(id: NodeId, pose: P): void;
}

function makeScene(
  poses: Record<string, P>,
  parents: Record<string, string | null>,
  childMap: Record<string, string[]>,
  roots: string[],
): StubScene {
  const p = new Map(Object.entries(poses));
  const c = new Map(Object.entries(childMap).map(([k, v]) => [k, v as NodeId[]]));
  const appliedBatches: AppliedBatch[] = [];
  return {
    poses: p,
    childMap: c,
    roots: roots as NodeId[],
    appliedBatches,
    get(id) {
      if (!p.has(id)) return undefined;
      return { pose: p.get(id)!, parent: (parents[id] ?? null) as NodeId | null };
    },
    childrenOf(id) { return c.get(id) ?? []; },
    applyBatch(ops, label) {
      appliedBatches.push({ ops: ops as { id?: string; label?: string }[], label });
    },
    batch(_label, fn) { fn(); },
    setPose(id, pose) { p.set(id as string, pose); },
  };
}

/** Resolve a layout by container id. Either a fn or a map of id → strategy. */
type GetLayout = NonNullable<LayoutDep['getLayout']> | Record<string, unknown>;

function makeCtx(
  scene: StubScene,
  selectionIds: string[],
  drag?: InvocationCtx['drag'],
  getLayout?: GetLayout,
  applyOps?: (ops: unknown[], label?: string) => void,
  // Pose-composition strategy. Defaults to LOCAL (parent translation) so the
  // existing local-model tests keep passing. Pass `null` to OMIT the dep and
  // exercise the kit's IDENTITY (absolute-pose) default.
  poseComposition: typeof LOCAL_PC | null = LOCAL_PC,
): InvocationCtx {
  const grid = tileGrid<P>({ cols: 2, rows: 1 });
  const defaultGet: LayoutDep['getLayout'] = (id) => (id === 'C' ? (grid as never) : null);
  const resolve: LayoutDep['getLayout'] = getLayout === undefined
    ? defaultGet
    : typeof getLayout === 'function'
      ? getLayout
      : (id) => ((getLayout as Record<string, unknown>)[id] as never) ?? null;
  const layout: LayoutDep = { getLayout: resolve };
  const deps: Record<string, unknown> = {
    selection: { get: () => selectionIds as NodeId[] },
    scene,
    layout,
  };
  if (poseComposition) deps.poseComposition = poseComposition;
  if (applyOps) deps.applyOps = applyOps;
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps,
    drag,
  } as unknown as InvocationCtx;
}

describe('moveAction layout reflow', () => {
  it('folds destination reflow into previews when dragging within a tileGrid', () => {
    const scene = makeScene(
      {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C' },
      { C: ['a', 'b'] },
      ['C'],
    );
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a']));
    handle.onMove!(makeCtx(scene, ['a'], {
      start: { x: 25, y: 50 },
      current: { x: 75, y: 50 },
      delta: { x: 50, y: 0 },
    }) as InvocationCtx);

    const ids = [...(handle.previewIds!() as Iterable<string>)];
    expect(ids).toContain('b'); // sibling reflowed into the preview channel
    const bPose = handle.previewPose!('b') as P;
    expect(bPose.x).toBe(0); // b swapped to cell 0
  });

  it('finds a container whose pose is non-rect (PolygonPath) via its AABB', () => {
    // Container C carries a PolygonPath pose (no direct x/y/width/height).
    // Absolute-pose model (no poseComposition) so composeWorldPose leaves the
    // non-rect pose intact. The layout hit-test must derive C's AABB from the
    // pose descriptor; casting the polygon to `{x,y,width,height}` yields NaN
    // and the container is never found — no reflow fires.
    const scene = makeScene(
      {
        C: squarePolygon(0, 0, 100, 100) as unknown as P,
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C' },
      { C: ['a', 'b'] },
      ['C'],
    );
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    // `null` → omit poseComposition → IDENTITY (absolute) default.
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, undefined, undefined, null));
    handle.onMove!(makeCtx(scene, ['a'], {
      start: { x: 25, y: 50 },
      current: { x: 75, y: 50 },
      delta: { x: 50, y: 0 },
    }, undefined, undefined, null) as InvocationCtx);

    const ids = [...(handle.previewIds!() as Iterable<string>)];
    expect(ids).toContain('b'); // sibling reflowed → container WAS found
    const bPose = handle.previewPose!('b') as P;
    expect(bPose.x).toBe(0); // b swapped to cell 0
  });

  it('commits commitDrop ops on a same-container grid swap', () => {
    const scene = makeScene(
      {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C' },
      { C: ['a', 'b'] },
      ['C'],
    );
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a']));
    const drag = { start: { x: 25, y: 50 }, current: { x: 75, y: 50 }, delta: { x: 50, y: 0 } };
    handle.onMove!(makeCtx(scene, ['a'], drag) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag) as InvocationCtx, 'commit');

    expect(scene.appliedBatches.length).toBe(1);
    const batch = scene.appliedBatches[0];
    expect(batch.ops.length).toBeGreaterThan(0);
    expect(batch.ops.some((o) => o.args?.id === 'a')).toBe(true);
  });

  it('emits a reparent op before the drop on a cross-container grid drag', () => {
    // Source C (tileGrid) holds a, b at {0..100}; destination D (tileGrid)
    // holds d1 at {200..300}. Dragging a's center into D should commit, in
    // order: reparent(a -> D), drop(a), then the source reflow for b (which
    // collapses into C's first cell once a leaves).
    const scene = makeScene(
      {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 100, height: 100 },
        d1: { x: 0, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C', D: null, d1: 'D' },
      { C: ['a', 'b'], D: ['d1'] },
      ['C', 'D'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts));
    // Drag a (center {25,50}) into D: delta.x 200 puts the preview center at
    // {225,50}, inside D's first cell, so runLayoutPass picks D as dest.
    const drag = { start: { x: 25, y: 50 }, current: { x: 225, y: 50 }, delta: { x: 200, y: 0 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    expect(scene.appliedBatches.length).toBe(1);
    const ops = scene.appliedBatches[0].ops;

    // Reparent op: name 'reparent', args.id === 'a', args.toParentId === 'D'.
    const reparentIdx = ops.findIndex(
      (o) => o.name === 'reparent' && o.args?.id === 'a',
    );
    expect(reparentIdx).toBeGreaterThanOrEqual(0);
    expect(ops[reparentIdx].args?.toParentId).toBe('D');

    // Drop op for a: a transform op (no 'reparent' name) targeting a.
    const dropIdx = ops.findIndex(
      (o) => o.name !== 'reparent' && o.args?.id === 'a',
    );
    expect(dropIdx).toBeGreaterThanOrEqual(0);

    // Ordering contract: reparent precedes the drop.
    expect(reparentIdx).toBeLessThan(dropIdx);

    // Source reflow for b (C collapses to a single cell) lands after the drop.
    const reflowIdx = ops.findIndex(
      (o) => o.name !== 'reparent' && o.args?.id === 'b',
    );
    expect(reflowIdx).toBeGreaterThanOrEqual(0);
    expect(reflowIdx).toBeGreaterThan(dropIdx);
  });

  it('finds the destination when the source container is not at world origin', () => {
    // Source C at world {40,40} holds child a (LOCAL {0,0}); destination D at
    // world {200,0} holds d1 (LOCAL {0,0}). Pre-migration draggedCenter is
    // computed in C-local space, so it never lands inside D's world bounds —
    // the drag falls through to a translate-only commit (no reparent op,
    // appliedBatches stays empty).
    const scene = makeScene(
      {
        C: { x: 40, y: 40, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 100, height: 100 },
        d1: { x: 0, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C', D: null, d1: 'D' },
      { C: ['a', 'b'], D: ['d1'] },
      ['C', 'D'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts));
    // a world center starts at {40+25, 40+50} = {65,90}. delta {160,-40} puts
    // the world center at {225,50}, inside D's first cell.
    const drag = { start: { x: 65, y: 90 }, current: { x: 225, y: 50 }, delta: { x: 160, y: -40 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    expect(scene.appliedBatches.length).toBe(1);
    const ops = scene.appliedBatches[0].ops;
    const reparent = ops.find((o) => o.name === 'reparent' && o.args?.id === 'a');
    expect(reparent).toBeDefined();
    expect(reparent!.args?.toParentId).toBe('D');
  });

  it('writes the dropped child pose LOCAL to the destination container', () => {
    // D at world {200,0}; the snapped cell is D's cell 0 at world {200,0}.
    // Because the scene stores local poses, the committed pose must be {0,0}
    // (local to D), which composes back to the world cell. Pre-commit-migration
    // the transform writes the world pose {200,0} → wrong.
    const scene = makeScene(
      {
        C: { x: 40, y: 40, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 100, height: 100 },
        d1: { x: 0, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C', D: null, d1: 'D' },
      { C: ['a', 'b'], D: ['d1'] },
      ['C', 'D'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts));
    const drag = { start: { x: 65, y: 90 }, current: { x: 225, y: 50 }, delta: { x: 160, y: -40 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    const ops = scene.appliedBatches[0].ops;
    const drop = ops.find((o) => o.name === 'transform' && o.args?.id === 'a');
    expect(drop).toBeDefined();
    expect(drop!.args?.to).toMatchObject({ x: 0, y: 0 });
  });

  it('lands a drop into a NESTED destination at the correct world position', () => {
    // Outer O at world {100,0} (no layout). Destination D nested under O at
    // LOCAL {50,0} → world {150,0}, holding d1 (local {0,0}). Source C at world
    // {0,0} holds a (local {0,0}). Dragging a into D's cell 0 (world {150,0})
    // must reparent a → D and write a's pose LOCAL to D ({0,0}), guarding the
    // rebase direction (D's world origin ≠ its local pose).
    const scene = makeScene(
      {
        O: { x: 100, y: 0, width: 200, height: 100 },
        D: { x: 50, y: 0, width: 100, height: 100 },
        d1: { x: 0, y: 0, width: 50, height: 100 },
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
      },
      { O: null, D: 'O', d1: 'D', C: null, a: 'C' },
      { O: ['D'], D: ['d1'], C: ['a'] },
      ['O', 'C'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid }; // O has no layout
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts));
    // a world center {25,50}; delta {150,0} → world center {175,50}, inside D's
    // cell 0 (world {150,0,50,100}).
    const drag = { start: { x: 25, y: 50 }, current: { x: 175, y: 50 }, delta: { x: 150, y: 0 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    const ops = scene.appliedBatches[0].ops;
    const reparent = ops.find((o) => o.name === 'reparent' && o.args?.id === 'a');
    expect(reparent).toBeDefined();
    expect(reparent!.args?.toParentId).toBe('D');
    const drop = ops.find((o) => o.name === 'transform' && o.args?.id === 'a');
    expect(drop).toBeDefined();
    expect(drop!.args?.to).toMatchObject({ x: 0, y: 0 }); // local to D; world = {150,0}
  });

  it('ABSOLUTE model (no poseComposition): commits the WORLD cell origin, not rebased to local', () => {
    // Absolute-pose scene (mirrors the kit's base scene + layoutDemo): every
    // node stores WORLD coords; containers are grouping-only with no transform.
    // Source container C at world {40,40} holds child `a` stored at WORLD
    // {40,40}; destination D at world {200,0} holds d1 at WORLD {200,0}.
    // Dragging a into D's cell 0 (world {200,0}) must commit a's pose AS the
    // world cell origin {200,0} — NOT rebased to local {0,0} under D — because
    // with no poseComposition dep the kit defaults to IDENTITY composition.
    const scene = makeScene(
      {
        C: { x: 40, y: 40, width: 100, height: 100 },
        a: { x: 40, y: 40, width: 50, height: 100 },
        b: { x: 90, y: 40, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 100, height: 100 },
        d1: { x: 200, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C', D: null, d1: 'D' },
      { C: ['a', 'b'], D: ['d1'] },
      ['C', 'D'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    // `null` → omit poseComposition → IDENTITY (absolute) default.
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts, undefined, null));
    // a world center {40+25, 40+50} = {65,90}; delta {160,-40} → world center
    // {225,50}, inside D's cell 0 (world {200,0,50,100}).
    const drag = { start: { x: 65, y: 90 }, current: { x: 225, y: 50 }, delta: { x: 160, y: -40 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts, undefined, null) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts, undefined, null) as InvocationCtx, 'commit');

    const ops = scene.appliedBatches[0].ops;
    const reparent = ops.find((o) => o.name === 'reparent' && o.args?.id === 'a');
    expect(reparent).toBeDefined();
    expect(reparent!.args?.toParentId).toBe('D');
    const drop = ops.find((o) => o.name === 'transform' && o.args?.id === 'a');
    expect(drop).toBeDefined();
    // WORLD cell origin — identity composition leaves the world pose untouched.
    expect(drop!.args?.to).toMatchObject({ x: 200, y: 0 });
  });

  it('routes the layout-drop commit through a consumer applyOps hook', () => {
    // Same cross-container drop as the LOCAL-to-destination test, but with a
    // consumer-supplied applyOps hook. The committed ops (reparent + transform
    // for a, plus source reflow) must flow through the hook instead of the
    // scene's own applyBatch — so an app with its own history captures the
    // gesture as a single undo entry.
    const scene = makeScene(
      {
        C: { x: 40, y: 40, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 100, height: 100 },
        d1: { x: 0, y: 0, width: 50, height: 100 },
      },
      { C: null, a: 'C', b: 'C', D: null, d1: 'D' },
      { C: ['a', 'b'], D: ['d1'] },
      ['C', 'D'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { C: grid, D: grid };
    const calls: { ops: { name?: string; args?: { id?: string } }[]; label?: string }[] = [];
    const applyOps = (ops: unknown[], label?: string) =>
      calls.push({ ops: ops as never, label });
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts, applyOps));
    const drag = { start: { x: 65, y: 90 }, current: { x: 225, y: 50 }, delta: { x: 160, y: -40 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts, applyOps) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts, applyOps) as InvocationCtx, 'commit');

    // The consumer hook took over: scene.applyBatch was NOT used.
    expect(scene.appliedBatches.length).toBe(0);
    // The hook was called exactly once with the committed ops + label.
    expect(calls.length).toBe(1);
    expect(calls[0].label).toBeDefined();
    expect(calls[0].ops.some((o) => o.name === 'reparent' && o.args?.id === 'a')).toBe(true);
    expect(calls[0].ops.some((o) => o.name === 'transform' && o.args?.id === 'a')).toBe(true);
  });

  it('falls through to translate commit when no layout accepts (no layoutPass)', () => {
    const scene = makeScene(
      { a: { x: 0, y: 0, width: 10, height: 10 } },
      { a: null }, {}, ['a'],
    );
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a']));
    const drag = { start: { x: 0, y: 0 }, current: { x: 5, y: 5 }, delta: { x: 5, y: 5 } };
    handle.onMove!(makeCtx(scene, ['a'], drag) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag) as InvocationCtx, 'commit');
    // With no consumer applyOps, the translate-only commit routes through the
    // scene's own history via applyBatch — one undo entry — emitting a
    // transform op that lands `a` at the translated pose.
    expect(scene.appliedBatches.length).toBe(1);
    expect(scene.appliedBatches[0].label).toBe('Move');
    const transform = scene.appliedBatches[0].ops.find(
      (o) => o.name === 'transform' && o.args?.id === 'a',
    );
    expect(transform).toBeDefined();
    expect(transform!.args?.to).toMatchObject({ x: 5, y: 5 });
  });

  it('routes the translate-only commit through a consumer applyOps hook', () => {
    // No layout accepts (no getLayout entry for the leaf), so the drag falls
    // through to the translate-only commit. With a consumer-supplied applyOps
    // hook, that commit must emit a transform op through the hook (consumer
    // history) instead of mutating the scene directly inside scene.batch.
    const scene = makeScene(
      { a: { x: 0, y: 0, width: 10, height: 10 } },
      { a: null }, {}, ['a'],
    );
    const calls: { ops: { name?: string; args?: { id?: string; to?: P } }[]; label?: string }[] = [];
    const applyOps = (ops: unknown[], label?: string) =>
      calls.push({ ops: ops as never, label });
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    // getLayout returns null for everything → translate-only path.
    const noLayout: GetLayout = () => null;
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, noLayout, applyOps));
    const drag = { start: { x: 0, y: 0 }, current: { x: 5, y: 5 }, delta: { x: 5, y: 5 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, noLayout, applyOps) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, noLayout, applyOps) as InvocationCtx, 'commit');

    // The consumer hook took over: scene.batch was NOT used to mutate poses,
    // and the hook was called exactly once with a transform op for `a`.
    expect(calls.length).toBe(1);
    expect(calls[0].label).toBe('Move');
    const transform = calls[0].ops.find((o) => o.name === 'transform' && o.args?.id === 'a');
    expect(transform).toBeDefined();
    expect(transform!.args?.to).toMatchObject({ x: 5, y: 5 });
  });
});
