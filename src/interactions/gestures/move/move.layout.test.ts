import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMove } from './move';
import { tileGrid, snapPoint } from '../../../layout/strategies';
import type { LayoutStrategy } from '../../../layout/types';
import type { MoveAdapter } from '../../../core/adapters/types';

type Obj = { id: string };
type P = { x: number; y: number; width: number; height: number };

function makeAdapter(opts: {
  poses: Record<string, P>;
  parents: Record<string, string | null>;
  children: Record<string, string[]>;
  getLayout: (id: string) => LayoutStrategy<P> | null;
}): MoveAdapter<Obj, P> & {
  setPoseSpy: ReturnType<typeof vi.fn>;
  applyBatchSpy: ReturnType<typeof vi.fn>;
} {
  const poses = { ...opts.poses };
  const setPoseSpy = vi.fn((id: string, p: P) => {
    poses[id] = p;
  });
  const applyBatchSpy = vi.fn();
  return {
    getObject: (id) => ({ id }),
    getObjects: () => Object.keys(poses).map((id) => ({ id })),
    getPose: (id) => poses[id],
    getParent: (id) => opts.parents[id] ?? null,
    setPose: setPoseSpy,
    setParent: () => {},
    getChildren: (id) => opts.children[id] ?? [],
    applyBatch: applyBatchSpy,
    getLayout: opts.getLayout,
    setPoseSpy,
    applyBatchSpy,
  };
}

describe('useMove with layout-bearing container', () => {
  it('publishes hypotheticalChildPositions when dragging within a tileGrid', () => {
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      parents: { C: null, a: 'C', b: 'C' },
      children: { C: ['a', 'b'] },
      getLayout: (id) => (id === 'C' ? grid : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 75,
        worldY: 50,
        clientX: 75,
        clientY: 50,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });

    const overlay = result.current.overlay!;
    expect(overlay.destContainerId).toBe('C');
    expect(overlay.accepted).toBe(true);
    // 'b' should be slated to swap into 'a's old cell.
    expect(overlay.hypotheticalChildPositions.get('b')).toEqual({
      x: 0, y: 0, width: 50, height: 100,
    });
  });

  it('publishes sourceReflowPositions when dragging across two tileGrids', () => {
    const gridA = tileGrid<P>({ cols: 2, rows: 1 });
    const gridB = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        A: { x: 0, y: 0, width: 100, height: 100 },
        B: { x: 200, y: 0, width: 100, height: 100 },
        a1: { x: 0, y: 0, width: 50, height: 100 },
        a2: { x: 50, y: 0, width: 50, height: 100 },
      },
      parents: { A: null, B: null, a1: 'A', a2: 'A' },
      children: { A: ['a1', 'a2'], B: [] },
      getLayout: (id) => (id === 'A' ? gridA : id === 'B' ? gridB : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a1'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 225,
        worldY: 50,
        clientX: 225,
        clientY: 50,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });

    const overlay = result.current.overlay!;
    expect(overlay.destContainerId).toBe('B');
    // Source side: a2 should slide into a1's old cell.
    expect(overlay.sourceReflowPositions.get('a2')).toEqual({
      x: 0, y: 0, width: 50, height: 100,
    });
  });

  it('marks accepted=false when pointer is over no layout-bearing container', () => {
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
      },
      parents: { C: null, a: 'C' },
      children: { C: ['a'] },
      getLayout: (id) => (id === 'C' ? grid : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 500,
        worldY: 500,
        clientX: 500,
        clientY: 500,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });

    const overlay = result.current.overlay!;
    expect(overlay.destContainerId).toBeNull();
    expect(overlay.accepted).toBe(false);
  });

  it('marks accepted=false when pointer is over a snapPoint container but outside tolerance', () => {
    // Container 'C' is 100x100 with corner snap targets. Tolerance of 5 means
    // pickTarget rejects unless the pointer is within 5 world units of a corner.
    // Pointer at (50, 50) sits over the container but ~70 units from every corner.
    const strategy = snapPoint<P>({ pattern: 'corners', tolerance: 5 });
    const adapter = makeAdapter({
      poses: {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 20, height: 20 },
      },
      parents: { C: null, a: 'C' },
      children: { C: ['a'] },
      getLayout: (id) => (id === 'C' ? strategy : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 10, worldY: 10, clientX: 10, clientY: 10 });
    });
    act(() => {
      result.current.move({
        worldX: 50,
        worldY: 50,
        clientX: 50,
        clientY: 50,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });

    const overlay = result.current.overlay!;
    expect(overlay.accepted).toBe(false);
    expect(overlay.destContainerId).toBeNull();
  });
});

describe('useMove commit with layout', () => {
  it('emits commitDrop ops on release into a layout container', () => {
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
        b: { x: 50, y: 0, width: 50, height: 100 },
      },
      parents: { C: null, a: 'C', b: 'C' },
      children: { C: ['a', 'b'] },
      getLayout: (id) => (id === 'C' ? grid : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 75, worldY: 50, clientX: 75, clientY: 50,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });
    act(() => {
      result.current.end();
    });

    expect(adapter.applyBatchSpy).toHaveBeenCalledTimes(1);
    const [ops] = adapter.applyBatchSpy.mock.calls[0];
    // Two ops: dragged 'a' moving to cell (1,0) + swap 'b' moving to cell (0,0).
    expect(ops).toHaveLength(2);
    expect(ops.every((o) => typeof o.apply === 'function' && typeof o.invert === 'function')).toBe(true);
  });

  it('emits free-space setPose when no container accepted', () => {
    const grid = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 0, y: 0, width: 50, height: 100 },
      },
      parents: { C: null, a: 'C' },
      children: { C: ['a'] },
      getLayout: (id) => (id === 'C' ? grid : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 500, worldY: 500, clientX: 500, clientY: 500,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });
    act(() => {
      result.current.end();
    });

    expect(adapter.applyBatchSpy).toHaveBeenCalledTimes(1);
    const [ops] = adapter.applyBatchSpy.mock.calls[0];
    expect(ops).toHaveLength(1); // Single free-space transform for 'a'.
  });

  it('emits dest commitDrop + source reflow ops on cross-container drop', () => {
    const gridA = tileGrid<P>({ cols: 2, rows: 1 });
    const gridB = tileGrid<P>({ cols: 2, rows: 1 });
    const adapter = makeAdapter({
      poses: {
        A: { x: 0, y: 0, width: 100, height: 100 },
        B: { x: 200, y: 0, width: 100, height: 100 },
        a1: { x: 0, y: 0, width: 50, height: 100 },
        a2: { x: 50, y: 0, width: 50, height: 100 },
      },
      parents: { A: null, B: null, a1: 'A', a2: 'A' },
      children: { A: ['a1', 'a2'], B: [] },
      getLayout: (id) => (id === 'A' ? gridA : id === 'B' ? gridB : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a1'], worldX: 25, worldY: 50, clientX: 25, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 225, worldY: 50, clientX: 225, clientY: 50,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });
    act(() => {
      result.current.end();
    });

    expect(adapter.applyBatchSpy).toHaveBeenCalledTimes(1);
    const [ops] = adapter.applyBatchSpy.mock.calls[0];
    // Dest commit: a1 → cell (0,0) of B. Source reflow: a2 → cell (0,0) of A.
    // No swap occupant in B (B is empty). So ops = [a1 drop] + [a2 reflow] = 2.
    expect(ops).toHaveLength(2);
  });
});
