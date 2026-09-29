import { describe, it, expect } from 'vitest';
import { tileGrid } from './tileGrid';
import { none } from '../snaps';

type P = { x: number; y: number; width: number; height: number };

const container = { id: 'C', bounds: { x: 0, y: 0, width: 100, height: 100 } };

describe('tileGrid', () => {
  it('childPoses falls back to id order when no child sits in a cell yet', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 2 });
    const children = [
      { id: 'b', pose: { x: 999, y: 999, width: 10, height: 10 } },
      { id: 'a', pose: { x: 999, y: 999, width: 10, height: 10 } },
      { id: 'c', pose: { x: 999, y: 999, width: 10, height: 10 } },
    ];
    const got = layout.childPoses(container, children);
    // 100x100 container, 2x2 grid, no gap → 50x50 cells.
    // All three sit outside the grid, so id order decides: a, b, c.
    expect(got.get('a')).toEqual({ x: 0, y: 0, width: 50, height: 50 });
    expect(got.get('b')).toEqual({ x: 50, y: 0, width: 50, height: 50 });
    expect(got.get('c')).toEqual({ x: 0, y: 50, width: 50, height: 50 });
  });

  it('childPoses compacts in current cell order, so a swap survives a sibling leaving', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 2 });
    // `b` was swapped into cell 0 and `a` into cell 1; `c` holds cell 2.
    // `c` then leaves the grid, and the reflow must not re-sort a and b.
    const children = [
      { id: 'a', pose: { x: 50, y: 0, width: 50, height: 50 } },
      { id: 'b', pose: { x: 0, y: 0, width: 50, height: 50 } },
    ];
    const got = layout.childPoses(container, children);
    expect(got.get('b')).toEqual({ x: 0, y: 0, width: 50, height: 50 });
    expect(got.get('a')).toEqual({ x: 50, y: 0, width: 50, height: 50 });
  });

  it('childPoses closes the hole a departing child leaves', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 2 });
    // Cell 0 is empty; `a` holds cell 1 and `b` cell 3. They compact up.
    const children = [
      { id: 'a', pose: { x: 50, y: 0, width: 50, height: 50 } },
      { id: 'b', pose: { x: 50, y: 50, width: 50, height: 50 } },
    ];
    const got = layout.childPoses(container, children);
    expect(got.get('a')).toEqual({ x: 0, y: 0, width: 50, height: 50 });
    expect(got.get('b')).toEqual({ x: 50, y: 0, width: 50, height: 50 });
  });

  it('skips overflow children beyond cols * rows', () => {
    const layout = tileGrid<P>({ cols: 1, rows: 1 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 10, height: 10 } },
      { id: 'b', pose: { x: 0, y: 0, width: 10, height: 10 } },
    ];
    const got = layout.childPoses(container, children);
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
    const got = layout.childPoses(container, children);
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

  it('reflowPoses swaps occupant when picked cell is occupied (same-container drag)', () => {
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
    const reflow = layout.reflowPoses(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: { x: 50, y: 0, width: 50, height: 100 },
      sourceContainerId: 'C',
    }, cell1);
    // 'b' should move into 'a's old cell.
    expect(reflow.get('b')).toEqual({ x: 0, y: 0, width: 50, height: 100 });
    expect(reflow.has('a')).toBe(false);
  });

  it('reflowPoses returns empty map when picked cell is empty', () => {
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
    const reflow = layout.reflowPoses(container, children, {
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

  it('reflowPoses swaps occupant under gap > 0 (no desync from gapped layout)', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1, gap: 10 });
    // 100 wide, 2 cols, 10 gap → cells width = 45. a at x=0, b at x=55.
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 45, height: 100 } },
      { id: 'b', pose: { x: 55, y: 0, width: 45, height: 100 } },
    ];
    const targets = layout.getDropTargets(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 45, height: 100 },
      pose: { x: 55, y: 0, width: 45, height: 100 },
      sourceContainerId: 'C',
    });
    const cell1 = targets.find((t) => (t.meta as { col: number }).col === 1)!;
    const reflow = layout.reflowPoses(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 45, height: 100 },
      pose: { x: 55, y: 0, width: 45, height: 100 },
      sourceContainerId: 'C',
    }, cell1);
    expect(reflow.get('b')).toEqual({ x: 0, y: 0, width: 45, height: 100 });
    expect(reflow.has('a')).toBe(false);
  });

  it('commitDrop with target=null emits a single op with to === dragged.pose', () => {
    const layout = tileGrid<P>({ cols: 2, rows: 1 });
    const children = [
      { id: 'a', pose: { x: 0, y: 0, width: 50, height: 100 } },
    ];
    const draggedPose = { x: 17, y: 23, width: 50, height: 100 };
    const ops = layout.commitDrop(container, children, {
      id: 'a',
      originPose: { x: 0, y: 0, width: 50, height: 100 },
      pose: draggedPose,
      sourceContainerId: 'C',
    }, null);
    expect(ops).toHaveLength(1);
    expect(ops[0].label).toBe('Tile drop');
    // Apply against a recording adapter to confirm `to === dragged.pose`.
    const calls: Array<{ id: string; pose: P }> = [];
    ops[0].apply({ setPose: (id: string, pose: P) => calls.push({ id, pose }) });
    expect(calls).toEqual([{ id: 'a', pose: draggedPose }]);
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

  it('cellToPose maps cell rect to point-only pose', () => {
    type Point = { x: number; y: number };
    const layout = tileGrid<Point>({
      cols: 2,
      rows: 1,
      cellToPose: (cell) => ({ x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 }),
    });
    const children = [
      { id: 'a', pose: { x: 25, y: 50 } as Point },
      { id: 'b', pose: { x: 75, y: 50 } as Point },
    ];
    const got = layout.childPoses(container, children);
    // 100x100 container, 2x1 grid → cells at (0,0,50,100) and (50,0,50,100).
    // Centers: (25,50), (75,50).
    expect(got.get('a')).toEqual({ x: 25, y: 50 });
    expect(got.get('b')).toEqual({ x: 75, y: 50 });
  });

  it('cellToPose drives the dropped pose in commitDrop (point-only pose)', () => {
    type Point = { x: number; y: number };
    const layout = tileGrid<Point>({
      cols: 2,
      rows: 1,
      cellToPose: (cell) => ({ x: cell.x + cell.width / 2, y: cell.y + cell.height / 2 }),
    });
    const children = [{ id: 'a', pose: { x: 25, y: 50 } as Point }];
    const targets = layout.getDropTargets(container, children, {
      id: 'd',
      originPose: { x: 0, y: 0 } as Point,
      pose: { x: 75, y: 50 } as Point,
      sourceContainerId: null,
    });
    const cell1 = targets.find((t) => (t.meta as { col: number }).col === 1)!;
    const ops = layout.commitDrop(container, children, {
      id: 'd',
      originPose: { x: 0, y: 0 } as Point,
      pose: { x: 75, y: 50 } as Point,
      sourceContainerId: null,
    }, cell1);
    expect(ops).toHaveLength(1);
    const calls: Array<{ id: string; pose: Point }> = [];
    ops[0].apply({ setPose: (id: string, pose: Point) => calls.push({ id, pose }) });
    // cellToPose maps cell (1,0) center → (75, 50).
    expect(calls).toEqual([{ id: 'd', pose: { x: 75, y: 50 } }]);
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

  describe('occupancy', () => {
    const cell = (x: number, y = 0): P => ({ x, y, width: 50, height: 100 });
    const colOf = (t: { meta?: unknown } | null) => (t?.meta as { col: number } | undefined)?.col;
    const incoming = (id: string, pose: P) => ({
      id, originPose: pose, pose, sourceContainerId: 'OTHER',
    });

    it('a cross-container drop is offered only the free cells', () => {
      const layout = tileGrid<P>({ cols: 2, rows: 1 });
      const targets = layout.getDropTargets(container, [{ id: 'a', pose: cell(0) }], incoming('d', cell(0)));
      expect(targets.map(colOf)).toEqual([1]);
    });

    it('a cross-container drop aimed at an occupied cell lands in the nearest free one', () => {
      const layout = tileGrid<P>({ cols: 2, rows: 1 });
      const targets = layout.getDropTargets(container, [{ id: 'a', pose: cell(0) }], incoming('d', cell(0)));
      expect(colOf(layout.snap.pickTarget(targets, { x: 25, y: 50 }))).toBe(1);
    });

    it('a second child of one drop does not land in the cell the first took', () => {
      // The drop pipeline hands each placement the state the previous produced:
      // here 'x' already sits in cell 0, and 'y' probes the same point.
      const layout = tileGrid<P>({ cols: 2, rows: 1 });
      const afterFirst = [{ id: 'x', pose: cell(0) }];
      const targets = layout.getDropTargets(container, afterFirst, incoming('y', cell(0)));
      expect(colOf(layout.snap.pickTarget(targets, { x: 10, y: 50 }))).toBe(1);
    });

    it('a full grid offers a cross-container drop nothing', () => {
      const layout = tileGrid<P>({ cols: 2, rows: 1 });
      const children = [{ id: 'a', pose: cell(0) }, { id: 'b', pose: cell(50) }];
      const targets = layout.getDropTargets(container, children, incoming('d', cell(0)));
      expect(layout.snap.pickTarget(targets, { x: 25, y: 50 })).toBeNull();
    });

    it('a same-container drag still offers occupied cells, to swap with', () => {
      const layout = tileGrid<P>({ cols: 2, rows: 1 });
      const children = [{ id: 'a', pose: cell(0) }, { id: 'b', pose: cell(50) }];
      const targets = layout.getDropTargets(container, children, {
        id: 'a', originPose: cell(0), pose: cell(50), sourceContainerId: 'C',
      });
      expect(targets.map(colOf)).toEqual([0, 1]);
    });

    it('swaps with whoever sits in the cell, not whoever sorts into it', () => {
      // 'a' and 'b' were swapped by an earlier drop, so id order no longer
      // says where either one is.
      const layout = tileGrid<P>({ cols: 2, rows: 1 });
      const children = [{ id: 'a', pose: cell(50) }, { id: 'b', pose: cell(0) }];
      const dragged = { id: 'a', originPose: cell(50), pose: cell(0), sourceContainerId: 'C' };
      const targets = layout.getDropTargets(container, children, dragged);
      const cell0 = targets.find((t) => colOf(t) === 0)!;
      const reflow = layout.reflowPoses(container, children, dragged, cell0);
      expect(reflow.get('b')).toEqual(cell(50));
    });
  });
});

