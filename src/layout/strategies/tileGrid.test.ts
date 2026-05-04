import { describe, it, expect } from 'vitest';
import { tileGrid } from './tileGrid';
import { none } from '../snaps';

type P = { x: number; y: number; width: number; height: number };

const container = { id: 'C', bounds: { x: 0, y: 0, width: 100, height: 100 } };

describe('tileGrid', () => {
  it('getChildPositions assigns children to cells in id order', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 2 });
    const children = [
      { id: 'b', pose: { x: 999, y: 999, width: 10, height: 10 } },
      { id: 'a', pose: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'c', pose: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    const got = layout.getChildPositions(container, children);
    // 100x100 container, 2x2 grid, no gap → 50x50 cells.
    // Sorted ids: a, b, c → cells (0,0), (1,0), (0,1).
    expect(got.get('a')).toEqual({ x: 0, y: 0, width: 50, height: 50 });
    expect(got.get('b')).toEqual({ x: 50, y: 0, width: 50, height: 50 });
    expect(got.get('c')).toEqual({ x: 0, y: 50, width: 50, height: 50 });
  });

  it('skips overflow children beyond cols * rows', () => {
    const layout = tileGrid<P>({ cols: 1, rows: 1 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'b', pose: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    const got = layout.getChildPositions(container, children);
    expect(got.size).toBe(1);
    expect(got.has('a')).toBe(true);
    expect(got.has('b')).toBe(false);
  });

  it('honors gap', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1, gap: 10 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'b', pose: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    const got = layout.getChildPositions(container, children);
    // 100 wide, 2 cols, 10 gap → cells width = (100 - 10) / 2 = 45.
    // a at x=0, b at x=55.
    expect(got.get('a')?.x).toBe(0);
    expect(got.get('b')?.x).toBe(55);
  });

  it('getDropTargets emits one target per cell with cellRect meta', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 2 });
    const targets = layout.getDropTargets(
      container,
      [],
      {
        id: 'd',
        originPose: { x: 0, y: 0, width: 10, height: 10 },
        pose: { x: 0, y: 0, width: 10, height: 10 },
        sourceContainerId: null,
      },
    );
    expect(targets).toHaveLength(4);
    const tl = targets.find((t) => (t.meta as { col: number; row: number }).col === 0
      && (t.meta as { col: number; row: number }).row === 0)!;
    expect(tl.origin).toEqual({ x: 25, y: 25 }); // cell center: (0,0) → (50,50) center is (25,25)
    expect((tl.meta as { cellRect: P }).cellRect).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });

  it('reflowFor swaps occupant when picked cell is occupied (same-container drag)', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 50, height: 100 } },
      { id: 'b', pose: { x: 50, y: 0, width: 50, height: 100 } },
    ];
    // Drag 'a' onto cell (1,0) which is 'b'.
    const targets = layout.getDropTargets(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: 'C',
    });
    const cell1 = targets.find((t) => (t.meta as { col: number }).col === 1)!;
    const reflow = layout.reflowFor(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: 'C',
    }, cell1);
    // 'b' should move into 'a's old cell.
    expect(reflow.get('b')).toEqual({ x: 0, y: 0, width: 50, height: 100 });
    expect(reflow.has('a')).toBe(false);
  });

  it('reflowFor returns empty map when picked cell is empty', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 50, height: 100 } },
    ];
    const targets = layout.getDropTargets(container, children, {
      id: 'd',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: null,
    });
    const cell1 = targets.find((t) => (t.meta as { col: number }).col === 1)!;
    const reflow = layout.reflowFor(container, children, {
      id: 'd',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: null,
    }, cell1);
    expect(reflow.size).toBe(0);
  });

  it('commitDrop emits dragged setPose plus swap setPose on occupied drop', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 50, height: 100 } },
      { id: 'b', pose: { x: 50, y: 0, width: 50, height: 100 } },
    ];
    const targets = layout.getDropTargets(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: 'C',
    });
    const cell1 = targets.find((t) => (t.meta as { col: number }).col === 1)!;
    const ops = layout.commitDrop(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: 'C',
    }, cell1);
    expect(ops).toHaveLength(2);
    expect(ops.every((o) => o.label === 'Tile drop' || o.label === 'Tile swap')).toBe(true);
    expect(ops.every((o) => typeof o.apply === 'function' && typeof o.invert === 'function')).toBe(true);
  });

  it('default snap is cellAt (returns target under pointer)', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1 });
    const targets = layout.getDropTargets(container, [], {
      id: 'd',
      originPose: { x: 0, y: 0, width: 10, height: 10 },
      pose: { x: 0, y: 0, width: 10, height: 10 },
      sourceContainerId: null,
    });
    const got = layout.snap.pickTarget(targets, { x: 75, y: 50 });
    expect((got?.meta as { col: number }).col).toBe(1);
  });

  it('accepts a snap override', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1, snap: none<P>() });
    const targets = layout.getDropTargets(container, [], {
      id: 'd',
      originPose: { x: 0, y: 0, width: 10, height: 10 },
      pose: { x: 0, y: 0, width: 10, height: 10 },
      sourceContainerId: null,
    });
    expect(layout.snap.pickTarget(targets, { x: 25, y: 25 })).toBeNull();
  });
});
