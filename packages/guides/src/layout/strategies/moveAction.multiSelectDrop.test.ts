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
  makeCtx,
  heldPose,
} from './testing/moveLayoutStubs';

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
    expect(heldPose(scene, 'e')!.x).toBe(0);
    // The dragged children still ghost at the translated position, not in
    // their snapped cells.
    expect(heldPose(scene, 'a')!.x).toBe(200);
    expect(heldPose(scene, 'b')!.x).toBe(250);
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

  it('does not stack two children whose probes land in one cell', () => {
    // D's cells are 100 wide and a, b are 40 wide side by side, so both probe
    // into D's first cell.
    const scene = makeScene(
      {
        a: { x: 0, y: 0, width: 40, height: 100 },
        b: { x: 40, y: 0, width: 40, height: 100 },
        D: { x: 200, y: 0, width: 200, height: 100 },
      },
      { a: null, b: null, D: null },
      { D: [] },
      ['a', 'b', 'D'],
    );
    const layouts = { D: tileGrid<P>({ cols: 2, rows: 1 }) };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a', 'b'], undefined, layouts));
    const drag = { start: { x: 40, y: 50 }, current: { x: 240, y: 50 }, delta: { x: 200, y: 0 } };
    handle.onMove!(makeCtx(scene, ['a', 'b'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a', 'b'], drag, layouts) as InvocationCtx, 'commit');

    const ops = scene.appliedBatches[0].ops;
    const dropA = ops.find((o) => o.name === 'transform' && o.args?.id === 'a');
    const dropB = ops.find((o) => o.name === 'transform' && o.args?.id === 'b');
    expect(dropA!.args?.to).toMatchObject({ x: 0, y: 0 });
    expect(dropB!.args?.to).toMatchObject({ x: 100, y: 0 });
  });

  it('does not drop a child from outside onto an occupied cell', () => {
    const scene = makeScene(
      {
        a: { x: 0, y: 0, width: 40, height: 100 },
        D: { x: 200, y: 0, width: 200, height: 100 },
        d1: { x: 0, y: 0, width: 100, height: 100 },
      },
      { a: null, D: null, d1: 'D' },
      { D: ['d1'] },
      ['a', 'D'],
    );
    const layouts = { D: tileGrid<P>({ cols: 2, rows: 1 }) };
    const invoker = moveAction.invoker;
    if (!invoker || invoker.timing !== 'ongoing') throw new Error('expected ongoing');
    const handle = invoker.start(makeCtx(scene, ['a'], undefined, layouts));
    // a's center {20,50} → {220,50}: inside d1's cell.
    const drag = { start: { x: 20, y: 50 }, current: { x: 220, y: 50 }, delta: { x: 200, y: 0 } };
    handle.onMove!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx);
    handle.onEnd!(makeCtx(scene, ['a'], drag, layouts) as InvocationCtx, 'commit');

    const ops = scene.appliedBatches[0].ops;
    expect(ops.find((o) => o.name === 'transform' && o.args?.id === 'a')!.args?.to)
      .toMatchObject({ x: 100, y: 0 });
    expect(ops.some((o) => o.args?.id === 'd1')).toBe(false);
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
