import { describe, it, expect } from 'vitest';
import {
  moveAction,
  type InvocationCtx,
  createTransformOp,
} from '@weasel-js/core';
import { tileGrid } from './tileGrid';
import {
  type P,
  makeScene,
  type GetLayout,
  makeCtx,
} from './testing/moveLayoutStubs';

describe('moveAction layout reflow', () => {
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

    // The child stays where the pointer left it, out of the container it left.
    const ops = scene.appliedBatches[0].ops;
    expect(ops.some((o) => o.args?.id === 'a' && o.args?.to?.x === 500 && o.args?.to?.y === 500)).toBe(true);
    expect(ops.find((o) => o.name === 'reparent' && o.args?.id === 'a')?.args?.toParentId).toBeNull();
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
