import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMove } from './move';
import type { LayoutStrategy } from '../../../layout/types';
import type { MoveAdapter } from 'core/adapters/types';

type Obj = { id: string };
type P = { x: number; y: number; width: number; height: number };

interface AdapterOpts {
  poses: Record<string, P>;
  parents: Record<string, string | null>;
  children: Record<string, string[]>;
  /** Sibling order including the root. Drives z-order via `getChildren(null)`
   *  for root-parented ids. */
  siblingOrder: Record<string | 'root', string[]>;
  getLayout: (id: string) => LayoutStrategy<P> | null;
  /** When true, do NOT install `getChildren` (test the fallback path). */
  omitGetChildren?: boolean;
  /** Iteration order for `getObjects` — used by the fallback path. */
  iterationOrder?: string[];
}

function makeAdapter(opts: AdapterOpts): MoveAdapter<Obj, P> {
  const poses = { ...opts.poses };
  const setPoseSpy = vi.fn((id: string, p: P) => {
    poses[id] = p;
  });
  const all = opts.iterationOrder ?? Object.keys(poses);
  const adapter: MoveAdapter<Obj, P> = {
    getObject: (id) => ({ id }),
    getObjects: () => all.map((id) => ({ id })),
    getPose: (id) => poses[id],
    getParent: (id) => opts.parents[id] ?? null,
    setPose: setPoseSpy,
    setParent: () => {},
    applyBatch: vi.fn(),
    getLayout: opts.getLayout,
  };
  if (!opts.omitGetChildren) {
    adapter.getChildren = ((id: string | null) => {
      if (id === null) return opts.siblingOrder.root ?? [];
      return opts.siblingOrder[id] ?? opts.children[id] ?? [];
    }) as (id: string) => string[];
  }
  return adapter;
}

// Trivial accept-anywhere layout: every container's `contains` returns true.
function acceptAllLayout(): LayoutStrategy<P> {
  return {
    contains: () => true,
    getChildPositions: () => new Map(),
    getDropTargets: (container) => [{
      pose: container.bounds as unknown as P,
      origin: { x: container.bounds.x, y: container.bounds.y },
    }],
    reflowFor: () => new Map(),
    commitDrop: () => [],
    snap: { pickTarget: (targets) => targets[0] ?? null },
  };
}

describe('useMove z-order-aware container pick', () => {
  it('picks the topmost container in z-order when getChildren is present (B drawn after A)', () => {
    // Two overlapping root-parented containers. `getChildren(null)` returns
    // ['A', 'B'] — B is the last sibling, so it's drawn on top.
    const layout = acceptAllLayout();
    const adapter = makeAdapter({
      poses: {
        A: { x: 0, y: 0, width: 100, height: 100 },
        B: { x: 0, y: 0, width: 100, height: 100 },
        d: { x: 40, y: 40, width: 20, height: 20 },
      },
      parents: { A: null, B: null, d: null },
      children: { A: [], B: [] },
      siblingOrder: { root: ['A', 'B'] },
      getLayout: (id) => (id === 'A' || id === 'B') ? layout : null,
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['d'], worldX: 50, worldY: 50, clientX: 50, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 55, worldY: 55, clientX: 55, clientY: 55,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });
    expect(result.current.overlay!.destContainerId).toBe('B');
  });

  it('picks A when sibling order puts A on top (z-order is the source of truth, not getObjects iteration)', () => {
    // Same setup but reverse the sibling order: A is last, so A is on top.
    // getObjects iterates in a CONFLICTING order to prove the z-order walk
    // dominates the iteration-order proxy.
    const layout = acceptAllLayout();
    const adapter = makeAdapter({
      poses: {
        A: { x: 0, y: 0, width: 100, height: 100 },
        B: { x: 0, y: 0, width: 100, height: 100 },
        d: { x: 40, y: 40, width: 20, height: 20 },
      },
      parents: { A: null, B: null, d: null },
      children: { A: [], B: [] },
      siblingOrder: { root: ['B', 'A'] }, // A on top
      iterationOrder: ['A', 'B', 'd'], // would pick B if iteration-order won
      getLayout: (id) => (id === 'A' || id === 'B') ? layout : null,
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['d'], worldX: 50, worldY: 50, clientX: 50, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 55, worldY: 55, clientX: 55, clientY: 55,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });
    expect(result.current.overlay!.destContainerId).toBe('A');
  });

  it('picks the deepest container when nested layouts both contain the point', () => {
    // Outer container 'O' contains inner container 'I' at root sibling order
    // [O]; O's children are [I]. Both have layouts. Dragging into the inner
    // should pick I (deepest wins).
    const layout = acceptAllLayout();
    const adapter = makeAdapter({
      poses: {
        O: { x: 0, y: 0, width: 200, height: 200 },
        I: { x: 50, y: 50, width: 100, height: 100 },
        d: { x: 80, y: 80, width: 20, height: 20 },
      },
      parents: { O: null, I: 'O', d: null },
      children: { O: ['I'], I: [] },
      siblingOrder: { root: ['O'], O: ['I'] },
      getLayout: (id) => (id === 'O' || id === 'I') ? layout : null,
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['d'], worldX: 100, worldY: 100, clientX: 100, clientY: 100 });
    });
    act(() => {
      result.current.move({
        worldX: 105, worldY: 105, clientX: 105, clientY: 105,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });
    expect(result.current.overlay!.destContainerId).toBe('I');
  });

  it('falls back to getObjects iteration order when getChildren is absent', () => {
    // getChildren omitted — the fallback (last-in-iteration wins) decides.
    const layout = acceptAllLayout();
    const adapter = makeAdapter({
      poses: {
        A: { x: 0, y: 0, width: 100, height: 100 },
        B: { x: 0, y: 0, width: 100, height: 100 },
        d: { x: 40, y: 40, width: 20, height: 20 },
      },
      parents: { A: null, B: null, d: null },
      children: {},
      siblingOrder: {},
      omitGetChildren: true,
      iterationOrder: ['A', 'B', 'd'], // last container in iteration is B
      getLayout: (id) => (id === 'A' || id === 'B') ? layout : null,
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['d'], worldX: 50, worldY: 50, clientX: 50, clientY: 50 });
    });
    act(() => {
      result.current.move({
        worldX: 55, worldY: 55, clientX: 55, clientY: 55,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });
    expect(result.current.overlay!.destContainerId).toBe('B');
  });
});
