import { describe, it, expect } from 'vitest';
import { createPoseOverrides } from 'core/scene/poseOverrides';
import type { PoseOverrides } from 'core/scene/types';
import { moveAction } from './move';
import type { InvocationCtx } from '../invoker';
import { tileGrid } from '../../../layout/strategies';
import { createTransformOp } from 'core/ops/transform';
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
  overrides: PoseOverrides<unknown>;
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
    overrides: createPoseOverrides<unknown>((id) => (p.has(id) ? { } : undefined)),
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

  it('skips a container whose acceptsDrop rejects the dragged node', () => {
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
    const seen: string[] = [];
    const picky = {
      ...tileGrid<P>({ cols: 2, rows: 1 }),
      acceptsDrop: (container: { id: string }, dragged: { id: string }) => {
        seen.push(`${container.id}:${dragged.id}`);
        return false;
      },
    };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, { C: picky }));
    handle.onMove!(makeCtx(scene, ['a'], {
      start: { x: 25, y: 50 },
      current: { x: 75, y: 50 },
      delta: { x: 50, y: 0 },
    }, { C: picky }) as InvocationCtx);

    expect(seen).toEqual(['C:a']);
    // No reflow: only the dragged node is in the preview channel.
    expect([...(handle.previewIds!() as Iterable<string>)]).toEqual(['a']);
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

  it('lets the source layout re-place a child dropped outside every container', () => {
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
    const released: string[] = [];
    const homing = {
      ...tileGrid<P>({ cols: 2, rows: 1 }),
      releaseDrop: (
        container: { id: string },
        _children: unknown,
        dragged: { id: string; originPose: P; pose: P },
      ) => {
        released.push(`${container.id}:${dragged.id}`);
        return [createTransformOp<P>({
          id: dragged.id, from: dragged.pose, to: dragged.originPose, label: 'Release',
        })];
      },
    };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, { C: homing }));
    // Well clear of C, so no container accepts and there is no layout pass.
    const drag = { start: { x: 25, y: 50 }, current: { x: 525, y: 550 }, delta: { x: 500, y: 500 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, { C: homing }) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, { C: homing }) as InvocationCtx, 'commit');

    expect(released).toEqual(['C:a']);
    expect(scene.appliedBatches.length).toBe(1);
    const ops = scene.appliedBatches[0].ops;
    expect(ops.some((o) => o.args?.id === 'a' && o.args?.to?.x === 0 && o.args?.to?.y === 0)).toBe(true);
  });

  it('falls through to the free-space commit when releaseDrop returns null', () => {
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
    const letGo = { ...tileGrid<P>({ cols: 2, rows: 1 }), releaseDrop: () => null };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, { C: letGo }));
    const drag = { start: { x: 25, y: 50 }, current: { x: 525, y: 550 }, delta: { x: 500, y: 500 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, { C: letGo }) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, { C: letGo }) as InvocationCtx, 'commit');

    // Today's behavior: the child stays where the pointer left it.
    const ops = scene.appliedBatches[0].ops;
    expect(ops.some((o) => o.args?.id === 'a' && o.args?.to?.x === 500 && o.args?.to?.y === 500)).toBe(true);
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

describe('moveAction multi-select layout drop', () => {
  /** Source C (tileGrid 3×1) holds a, b, e; destination D (tileGrid 2×1) is
   *  empty. Selecting a + b and dragging them into D is the canonical
   *  multi-select case: one destination for the whole selection, each child
   *  placed in turn. */
  function twoIntoEmptyGrid() {
    const scene = makeScene(
      {
        C: { x: 0, y: 0, width: 150, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
        e: { x: 100, y: 0, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 100, height: 100 },
      },
      { C: null, a: 'C', b: 'C', e: 'C', D: null },
      { C: ['a', 'b', 'e'], D: [] },
      ['C', 'D'],
    );
    const layouts = {
      C: tileGrid<P>({ cols: 3, rows: 1 }),
      D: tileGrid<P>({ cols: 2, rows: 1 }),
    };
    // Selection center travels from {75,50} to {275,50}... the union of a and
    // b spans {0,0}–{100,100}, so its center is {50,50} → {250,50} under the
    // delta, which lands inside D.
    const drag = { start: { x: 50, y: 50 }, current: { x: 250, y: 50 }, delta: { x: 200, y: 0 } };
    return { scene, layouts, drag };
  }

  it('fills consecutive cells: each child sees the state the previous produced', () => {
    const { scene, layouts, drag } = twoIntoEmptyGrid();
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a', 'b'], undefined, layouts));
    handle.onMove!(makeCtx(scene, ['a', 'b'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a', 'b'], drag, layouts) as InvocationCtx, 'commit');

    expect(scene.appliedBatches.length).toBe(1);
    const ops = scene.appliedBatches[0].ops;

    const reparentA = ops.findIndex((o) => o.name === 'reparent' && o.args?.id === 'a');
    const reparentB = ops.findIndex((o) => o.name === 'reparent' && o.args?.id === 'b');
    expect(reparentA).toBeGreaterThanOrEqual(0);
    expect(reparentB).toBeGreaterThanOrEqual(0);
    expect(ops[reparentA].args?.toParentId).toBe('D');
    expect(ops[reparentB].args?.toParentId).toBe('D');

    // Two children, two cells — local to D, whose world origin is {200,0}.
    const dropA = ops.findIndex((o) => o.name === 'transform' && o.args?.id === 'a');
    const dropB = ops.findIndex((o) => o.name === 'transform' && o.args?.id === 'b');
    expect(ops[dropA].args?.to).toMatchObject({ x: 0, y: 0 });
    expect(ops[dropB].args?.to).toMatchObject({ x: 50, y: 0 });

    // Ordering contract: every reparent precedes every drop.
    expect(Math.max(reparentA, reparentB)).toBeLessThan(Math.min(dropA, dropB));

    // Source reflow: C collapses to one cell once a and b leave, so e moves
    // to C's first cell — after the drops.
    const reflowE = ops.findIndex((o) => o.name === 'transform' && o.args?.id === 'e');
    expect(reflowE).toBeGreaterThan(Math.max(dropA, dropB));
    expect(ops[reflowE].args?.to).toMatchObject({ x: 0, y: 0 });
  });

  it('previews the source reflow while both children ghost under the pointer', () => {
    const { scene, layouts, drag } = twoIntoEmptyGrid();
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a', 'b'], undefined, layouts));
    handle.onMove!(makeCtx(scene, ['a', 'b'], drag, layouts) as InvocationCtx);

    const ids = [...(handle.previewIds!() as Iterable<string>)];
    expect(ids).toContain('e');
    expect((handle.previewPose!('e') as P).x).toBe(0);
    // The dragged children still ghost at the translated position, not in
    // their snapped cells.
    expect((handle.previewPose!('a') as P).x).toBe(200);
    expect((handle.previewPose!('b') as P).x).toBe(250);
    // Reflowed siblings paint settled; the dragged pair does not.
    const opaque = [...((handle.previewOpaqueIds!() ?? []) as Iterable<string>)];
    expect(opaque).toEqual(['e']);
  });

  it('lands the whole selection in one container even when a child sits over another', () => {
    // a's own center ends inside D1, b's inside D2. A per-child hit test would
    // scatter them; the selection's center picks D1 for both.
    const scene = makeScene(
      {
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 100, y: 0, width: 50, height: 100 },
        D1: { x: 200, y: 0, width: 100, height: 100 },
        D2: { x: 300, y: 0, width: 100, height: 100 },
      },
      { a: null, b: null, D1: null, D2: null },
      { D1: [], D2: [] },
      ['a', 'b', 'D1', 'D2'],
    );
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const layouts = { D1: grid, D2: grid };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a', 'b'], undefined, layouts));
    // Union {0,0}–{150,100}, center {75,50} → {275,50}, inside D1.
    const drag = { start: { x: 75, y: 50 }, current: { x: 275, y: 50 }, delta: { x: 200, y: 0 } };
    handle.onMove!(makeCtx(scene, ['a', 'b'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a', 'b'], drag, layouts) as InvocationCtx, 'commit');

    const ops = scene.appliedBatches[0].ops;
    const reparents = ops.filter((o) => o.name === 'reparent');
    expect(reparents.length).toBe(2);
    expect(reparents.every((o) => o.args?.toParentId === 'D1')).toBe(true);
    // b overshoots D1's cells, so it snaps to the nearest — cell 1.
    const dropB = ops.find((o) => o.name === 'transform' && o.args?.id === 'b');
    expect(dropB!.args?.to).toMatchObject({ x: 50, y: 0 });
  });

  it('rejects the container for the whole selection when acceptsDrop refuses one member', () => {
    const scene = makeScene(
      {
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 100, y: 0, width: 50, height: 100 },
        D: { x: 200, y: 0, width: 200, height: 100 },
      },
      { a: null, b: null, D: null },
      { D: [] },
      ['a', 'b', 'D'],
    );
    const seen: string[] = [];
    const picky = {
      ...tileGrid<P>({ cols: 2, rows: 1 }),
      acceptsDrop: (container: { id: string }, dragged: { id: string }) => {
        seen.push(`${container.id}:${dragged.id}`);
        return dragged.id !== 'b';
      },
    };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a', 'b'], undefined, { D: picky }));
    const drag = { start: { x: 75, y: 50 }, current: { x: 275, y: 50 }, delta: { x: 200, y: 0 } };
    handle.onMove!(makeCtx(scene, ['a', 'b'], drag, { D: picky }) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a', 'b'], drag, { D: picky }) as InvocationCtx, 'commit');

    expect(seen).toEqual(['D:a', 'D:b']);
    const ops = scene.appliedBatches[0].ops;
    expect(ops.some((o) => o.name === 'reparent')).toBe(false);
    expect(ops.find((o) => o.args?.id === 'a')!.args?.to).toMatchObject({ x: 200, y: 0 });
  });

  it('releases each dragged child through its own source container', () => {
    // a comes from a homing grid; f is a free top-level node. Dropping both in
    // open space sends a home and leaves f where the pointer stopped.
    const scene = makeScene(
      {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
        f: { x: 500, y: 500, width: 10, height: 10 },
      },
      { C: null, a: 'C', b: 'C', f: null },
      { C: ['a', 'b'] },
      ['C', 'f'],
    );
    const released: string[] = [];
    const homing = {
      ...tileGrid<P>({ cols: 2, rows: 1 }),
      releaseDrop: (
        container: { id: string },
        children: { id: string }[],
        dragged: { id: string; originPose: P; pose: P },
      ) => {
        released.push(`${container.id}:${dragged.id}:${children.map((c) => c.id).join('+')}`);
        return [createTransformOp<P>({
          id: dragged.id, from: dragged.pose, to: dragged.originPose, label: 'Release',
        })];
      },
    };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a', 'f'], undefined, { C: homing }));
    const drag = { start: { x: 0, y: 0 }, current: { x: 600, y: 600 }, delta: { x: 600, y: 600 } };
    handle.onMove!(makeCtx(scene, ['a', 'f'], drag, { C: homing }) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a', 'f'], drag, { C: homing }) as InvocationCtx, 'commit');

    expect(released).toEqual(['C:a:b']);
    const ops = scene.appliedBatches[0].ops;
    // a goes home; f keeps the translate it would have had on its own.
    expect(ops.find((o) => o.args?.id === 'a')!.args?.to).toMatchObject({ x: 0, y: 0 });
    expect(ops.find((o) => o.args?.id === 'f')!.args?.to).toMatchObject({ x: 1100, y: 1100 });
  });
});
