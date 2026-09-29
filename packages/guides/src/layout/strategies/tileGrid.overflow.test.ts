/**
 * A full tileGrid's overflow policy holds for every way a child can arrive:
 * dragged in, inserted by an op, or reparented by one. Under each policy the
 * child is refused whole or placed — never left where it happened to land.
 */
import { describe, expect, it } from 'vitest';
import { act } from '@testing-library/react';
import {
  createInsertOp,
  createReparentOp,
  createScene,
  defaultCommitAdapter,
  layoutArrivalHandler,
  moveAction,
  type InvocationCtx,
  type LayoutDep,
  type NodeId,
  type OngoingHandle,
  type OngoingInvoker,
  type RectPose,
} from '@weasel-js/core';
import { tileGrid, type TileGridOptions } from './tileGrid';

const rect = (x: number, y: number, width = 50, height = 50): RectPose => ({ x, y, width, height });

/** A 2×2 grid `G` over (0,0,100,100) — 50×50 cells — holding `held` children,
 *  and a loose root node `x` at (300,300). */
function setup(opts: Partial<TileGridOptions<RectPose>>, held = 4) {
  const scene = createScene<object, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const G = scene.add({ kind: 'container', id: 'G' as NodeId, layer: 'main', data: {}, pose: rect(0, 0, 100, 100) });
  const byColumn = opts.flow === 'column';
  for (let i = 0; i < held; i++) {
    const along = i % 2;
    const line = Math.floor(i / 2);
    const [col, row] = byColumn ? [line, along] : [along, line];
    scene.add({ kind: 'leaf', id: `k${i}` as NodeId, parent: G, layer: 'main', data: {}, pose: rect(col * 50, row * 50) });
  }
  const x = scene.add({ kind: 'leaf', id: 'x' as NodeId, layer: 'main', data: {}, pose: rect(300, 300) });
  const grid = tileGrid<RectPose>({ cols: 2, rows: 2, ...opts });
  const layouts = { G: grid };
  scene.setArrivalHandler(layoutArrivalHandler(scene, { layouts }));
  const adapter = defaultCommitAdapter(scene as never);
  const layout: LayoutDep = { getLayout: (id) => (id === 'G' ? (grid as never) : null) };

  const insert = () => scene.applyBatch([createInsertOp({
    node: { kind: 'leaf', id: 'n' as NodeId, layer: 'main', data: {}, pose: rect(20, 20), parent: G },
  })], 'Insert', adapter);
  const reparent = () => scene.applyBatch(
    [createReparentOp({ id: 'x', fromParentId: null, toParentId: 'G' })], 'Reparent', adapter,
  );
  /** Drag `x` so its center lands on `to`. `reparentOnDrop` also offers the
   *  grid as a plain parent, the path taken when its layout finds no target. */
  const drop = (to: { x: number; y: number }, reparentOnDrop = false) => {
    const from = { x: 325, y: 325 };
    const drag = { start: from, current: to, delta: { x: to.x - from.x, y: to.y - from.y } };
    const ctx = (d?: typeof drag): InvocationCtx => ({
      world: d ? d.current : from,
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {
        selection: { get: () => [x] }, scene, layout,
        ...(reparentOnDrop ? { nodeAtPoint: () => G } : {}),
      },
      drag: d,
    }) as unknown as InvocationCtx;
    const opts = reparentOnDrop ? { params: { reparentOnDrop: 'top' } } : {};
    const h = (moveAction.invoker as OngoingInvoker).start(ctx(), opts) as OngoingHandle;
    h.onMove!(ctx(drag));
    act(() => { h.onEnd!(ctx(drag), 'commit'); });
  };
  const pose = (id: string) => scene.get(id as NodeId)?.pose;
  const parent = (id: string) => scene.get(id as NodeId)?.parent;
  return { scene, grid, insert, reparent, drop, pose, parent };
}

const container = (height = 100, width = 100) => ({ id: 'G', bounds: { x: 0, y: 0, width, height } });

describe('tileGrid overflow — reject (the default)', () => {
  it('refuses a drop into a full grid', () => {
    const s = setup({});
    s.drop({ x: 50, y: 50 });
    // Not taken into the grid: it lands where it was let go, as any drop that
    // no container accepts does.
    expect(s.parent('x')).toBeNull();
  });

  it('refuses a reparent-on-drop into a full grid without throwing', () => {
    const s = setup({});
    expect(() => s.drop({ x: 50, y: 50 }, true)).not.toThrow();
    expect(s.parent('x')).toBeNull();
    expect(s.pose('x')).toEqual(rect(300, 300));
  });

  it('refuses an insert into a full grid', () => {
    const s = setup({});
    const depth = s.scene.historyIndex();
    s.insert();
    expect(s.scene.get('n' as NodeId)).toBeUndefined();
    expect(s.scene.historyIndex()).toBe(depth);
  });

  it('refuses a reparent into a full grid', () => {
    const s = setup({});
    s.reparent();
    expect(s.parent('x')).toBeNull();
    expect(s.pose('x')).toEqual(rect(300, 300));
  });

  it('places an inserted child in the free cell nearest to it', () => {
    const s = setup({}, 3);
    s.insert();
    expect(s.parent('n')).toBe('G');
    expect(s.pose('n')).toEqual(rect(50, 50));
  });

  it('places a reparented child in a free cell, undone with the reparent', () => {
    const s = setup({}, 3);
    s.reparent();
    expect(s.pose('x')).toEqual(rect(50, 50));
    s.scene.undo();
    expect(s.parent('x')).toBeNull();
    expect(s.pose('x')).toEqual(rect(300, 300));
  });

  it('childPoses places a child past the grid rather than skipping it', () => {
    const grid = tileGrid<RectPose>({ cols: 1, rows: 1 });
    const got = grid.childPoses(container(), [
      { id: 'a', pose: rect(0, 0, 10, 10) },
      { id: 'b', pose: rect(0, 0, 10, 10) },
    ]);
    expect(got.get('a')).toEqual(rect(0, 0, 100, 100));
    expect(got.get('b')).toEqual(rect(0, 100, 100, 100));
  });
});

describe('tileGrid overflow — grow', () => {
  it('a drop into a full grid opens a row and grows the container', () => {
    const s = setup({ overflow: 'grow' });
    s.drop({ x: 50, y: 50 });
    expect(s.parent('x')).toBe('G');
    expect(s.pose('x')).toEqual(rect(0, 100));
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 150));
  });

  it('an insert into a full grid opens a row and grows the container, in one undo step', () => {
    const s = setup({ overflow: 'grow' });
    s.insert();
    expect(s.pose('n')).toEqual(rect(0, 100));
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 150));
    s.scene.undo();
    expect(s.scene.get('n' as NodeId)).toBeUndefined();
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 100));
  });

  it('a reparent into a full grid opens a row and grows the container', () => {
    const s = setup({ overflow: 'grow' });
    s.reparent();
    // The free cell nearest to where x was.
    expect(s.pose('x')).toEqual(rect(50, 100));
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 150));
  });

  it('a column-major grid grows a column, and the container widens', () => {
    const s = setup({ overflow: 'grow', flow: 'column' });
    s.insert();
    expect(s.pose('n')).toEqual(rect(100, 0));
    expect(s.pose('G')).toEqual(rect(0, 0, 150, 100));
  });

  it('keeps the pitch across a gap', () => {
    const s = setup({ overflow: 'grow', gap: 10 }, 0);
    // 2×2 over 100×100 with a 10 gap → 45×45 cells at 0 and 55.
    for (let i = 0; i < 4; i++) {
      s.scene.applyBatch([createInsertOp({
        node: { kind: 'leaf', id: `g${i}` as NodeId, layer: 'main', data: {}, pose: rect(0, 0), parent: 'G' as NodeId },
      })], 'Insert', defaultCommitAdapter(s.scene as never));
    }
    s.reparent();
    expect(s.pose('x')).toEqual(rect(55, 110, 45, 45));
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 155));
  });

  it('a delete from a grown grid shrinks it back, in the same undo step', () => {
    const s = setup({ overflow: 'grow' });
    s.insert();
    const depth = s.scene.historyIndex();
    s.scene.remove('n' as NodeId);
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 100));
    // The pitch holds: the survivors keep their 50×50 cells.
    expect(s.pose('k3')).toEqual(rect(50, 50));
    expect(s.scene.historyIndex()).toBe(depth + 1);
    s.scene.undo();
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 150));
    expect(s.pose('n')).toEqual(rect(0, 100));
  });

  it('a reparent out of a grown grid shrinks it back', () => {
    const s = setup({ overflow: 'grow' });
    s.insert();
    s.scene.move('n' as NodeId, null);
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 100));
    expect(s.pose('k0')).toEqual(rect(0, 0));
  });

  it('shrinks by whole lines, and never below the declared rows', () => {
    const s = setup({ overflow: 'grow', gap: 10 }, 0);
    // 2×2 over 100×100 with a 10 gap: 45×45 cells, grown to three rows.
    for (let i = 0; i < 5; i++) {
      s.scene.applyBatch([createInsertOp({
        node: { kind: 'leaf', id: `g${i}` as NodeId, layer: 'main', data: {}, pose: rect(0, 0), parent: 'G' as NodeId },
      })], 'Insert', defaultCommitAdapter(s.scene as never));
    }
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 155));
    s.scene.remove('g0' as NodeId);
    // Four left fill two rows: the third goes, and the rest pack up.
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 100));
    expect(s.pose('g4')).toEqual(rect(55, 55, 45, 45));
    s.scene.removeMany(['g1', 'g2', 'g3'] as NodeId[]);
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 100));
    expect(s.pose('g4')).toEqual(rect(0, 0, 45, 45));
  });

  it('a column-major grid narrows back', () => {
    const s = setup({ overflow: 'grow', flow: 'column' });
    s.insert();
    s.scene.remove('k0' as NodeId);
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 100));
  });

  it('does not grow while a free cell remains', () => {
    const s = setup({ overflow: 'grow' }, 3);
    s.insert();
    expect(s.pose('n')).toEqual(rect(50, 50));
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 100));
  });
});

describe('tileGrid overflow — scroll', () => {
  it('a drop into a full grid takes the first cell past it; the container keeps its size', () => {
    const s = setup({ overflow: 'scroll' });
    s.drop({ x: 50, y: 50 });
    expect(s.parent('x')).toBe('G');
    expect(s.pose('x')).toEqual(rect(0, 100));
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 100));
  });

  it('an insert into a full grid takes the first cell past it', () => {
    const s = setup({ overflow: 'scroll' });
    s.insert();
    expect(s.pose('n')).toEqual(rect(0, 100));
    expect(s.pose('G')).toEqual(rect(0, 0, 100, 100));
  });

  it('a reparent into a full grid takes the first cell past it', () => {
    const s = setup({ overflow: 'scroll' });
    s.reparent();
    expect(s.pose('x')).toEqual(rect(50, 100));
  });

  it('reports the content extent the overflow reaches', () => {
    const grid = tileGrid<RectPose>({ cols: 2, rows: 2, overflow: 'scroll' });
    const five = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, pose: rect(0, 0) }));
    expect(grid.contentExtent!(container(), five)).toEqual({ x: 0, y: 0, width: 100, height: 150 });
    expect(grid.contentExtent!(container(), five.slice(0, 4))).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('a column-major grid runs on to the right', () => {
    const grid = tileGrid<RectPose>({ cols: 2, rows: 2, overflow: 'scroll', flow: 'column' });
    const five = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, pose: rect(0, 0) }));
    expect(grid.childPoses(container(), five).get('c4')).toEqual(rect(100, 0));
    expect(grid.contentExtent!(container(), five)).toEqual({ x: 0, y: 0, width: 150, height: 100 });
  });
});

describe('tileGrid flow', () => {
  it('a column-major grid fills down each column first', () => {
    const grid = tileGrid<RectPose>({ cols: 2, rows: 2, flow: 'column' });
    const three = Array.from({ length: 3 }, (_, i) => ({ id: `c${i}`, pose: rect(999, 999) }));
    const got = grid.childPoses(container(), three);
    expect(got.get('c0')).toEqual(rect(0, 0));
    expect(got.get('c1')).toEqual(rect(0, 50));
    expect(got.get('c2')).toEqual(rect(50, 0));
  });
});
