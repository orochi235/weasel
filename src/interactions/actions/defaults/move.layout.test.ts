import { describe, it, expect } from 'vitest';
import { moveAction } from './move';
import type { InvocationCtx } from '../invoker';
import { tileGrid } from '../../../layout/strategies';
import type { LayoutDep } from '../depSchema';
import type { NodeId } from 'core/scene/types';

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
): InvocationCtx {
  const grid = tileGrid<P>({ cols: 2, rows: 1 });
  const defaultGet: LayoutDep['getLayout'] = (id) => (id === 'C' ? (grid as never) : null);
  const resolve: LayoutDep['getLayout'] = getLayout === undefined
    ? defaultGet
    : typeof getLayout === 'function'
      ? getLayout
      : (id) => ((getLayout as Record<string, unknown>)[id] as never) ?? null;
  const layout: LayoutDep = { getLayout: resolve };
  return {
    world: { x: 0, y: 0 },
    screen: { x: 0, y: 0 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { selection: { get: () => selectionIds as NodeId[] }, scene, layout },
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
    expect(scene.appliedBatches.length).toBe(0);
    expect(scene.poses.get('a')).toEqual({ x: 5, y: 5, width: 10, height: 10 });
  });
});
