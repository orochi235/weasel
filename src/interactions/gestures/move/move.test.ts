import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMoveInteraction } from './move';
import { snapToGrid } from './behaviors/snapToGrid';
import { snapBackOrDelete } from './behaviors/snapBackOrDelete';
import type { MoveAdapter } from '../../../adapters/types';
import type { Op } from '../../../ops/types';

interface Pose { x: number; y: number }
interface Obj { id: string; pose: Pose; parent: string | null }

function makeAdapter(initial: Obj[]): MoveAdapter<Obj, Pose> & {
  store: Map<string, Obj>;
  batches: { ops: Op[]; label: string }[];
} {
  const store = new Map<string, Obj>(initial.map((o) => [o.id, { ...o, pose: { ...o.pose } }]));
  const batches: { ops: Op[]; label: string }[] = [];
  return {
    store,
    batches,
    getObject: (id) => store.get(id),
    getPose: (id) => store.get(id)!.pose,
    getParent: (id) => store.get(id)!.parent,
    setPose: (id, pose) => {
      store.get(id)!.pose = { ...pose };
    },
    setParent: (id, parent) => {
      store.get(id)!.parent = parent;
    },
    applyBatch: (ops, label) => {
      for (const op of ops) op.apply({
        setPose: (id: string, pose: Pose) => { store.get(id)!.pose = { ...pose }; },
        setParent: (id: string, p: string | null) => { store.get(id)!.parent = p; },
        insertObject: (o: Obj) => store.set(o.id, o),
        removeObject: (id: string) => store.delete(id),
      });
      batches.push({ ops, label });
    },
  };
}

const translatePose = (p: Pose, dx: number, dy: number) => ({ ...p, x: p.x + dx, y: p.y + dy });

describe('useMoveInteraction', () => {
  it('does not commit before threshold is exceeded', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: null }]);
    const { result } = renderHook(() => useMoveInteraction(adapter, { translatePose }));
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 0.05, worldY: 0.05, clientX: 1, clientY: 1, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());
    expect(adapter.batches).toEqual([]);
  });

  it('emits a default TransformOp batch when moved past threshold', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: null }]);
    const { result } = renderHook(() => useMoveInteraction(adapter, { translatePose, dragThresholdPx: 4 }));
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 5, worldY: 5, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());
    expect(adapter.batches.length).toBe(1);
    expect(adapter.store.get('a')!.pose).toEqual({ x: 5, y: 5 });
  });

  it('snapToGrid behavior rounds the proposed pose', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: null }]);
    const { result } = renderHook(() =>
      useMoveInteraction(adapter, { translatePose, behaviors: [snapToGrid<Pose>({ spacing: 1 })] }),
    );
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 5.4, worldY: 5.6, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());
    expect(adapter.store.get('a')!.pose).toEqual({ x: 5, y: 6 });
  });

  it('snapBackOrDelete with delete policy emits DeleteOp when far from origin', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: 'p' }]);
    const { result } = renderHook(() =>
      useMoveInteraction(adapter, {
        translatePose,
        behaviors: [snapBackOrDelete<Pose>({ radius: 1, onFreeRelease: 'delete' })],
      }),
    );
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 50, worldY: 50, clientX: 1000, clientY: 1000, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());
    expect(adapter.store.has('a')).toBe(false);
  });

  it('snap-back (within radius) commits no batch', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: 'p' }]);
    const { result } = renderHook(() =>
      useMoveInteraction(adapter, {
        translatePose,
        behaviors: [snapBackOrDelete<Pose>({ radius: 1, onFreeRelease: 'snap-back' })],
      }),
    );
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 0.3, worldY: 0.3, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());
    expect(adapter.batches).toEqual([]);
    expect(adapter.store.get('a')!.pose).toEqual({ x: 0, y: 0 });
  });

  it('group drag moves all dragged ids by the same delta', () => {
    const adapter = makeAdapter([
      { id: 'a', pose: { x: 0, y: 0 }, parent: null },
      { id: 'b', pose: { x: 10, y: 10 }, parent: null },
    ]);
    const { result } = renderHook(() => useMoveInteraction(adapter, { translatePose }));
    act(() => result.current.start({ ids: ['a', 'b'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 5, worldY: 5, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());
    expect(adapter.store.get('a')!.pose).toEqual({ x: 5, y: 5 });
    expect(adapter.store.get('b')!.pose).toEqual({ x: 15, y: 15 });
    expect(adapter.batches.length).toBe(1);
    expect(adapter.batches[0].ops.length).toBe(2);
  });

  it('expandIds is called once with input ids and its result drives draggedIds + poses', () => {
    const adapter = makeAdapter([
      { id: 'a', pose: { x: 0, y: 0 }, parent: null },
      { id: 'b', pose: { x: 10, y: 10 }, parent: null },
    ]);
    const calls: string[][] = [];
    const expandIds = (ids: string[]) => {
      calls.push(ids);
      return ids.includes('G') ? ['a', 'b'] : ids;
    };
    const { result } = renderHook(() => useMoveInteraction(adapter, { translatePose, expandIds }));
    act(() => result.current.start({ ids: ['G'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 5, worldY: 5, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    expect(calls).toEqual([['G']]);
    expect(result.current.overlay!.draggedIds).toEqual(['a', 'b']);
    expect(result.current.overlay!.poses.get('a')).toEqual({ x: 5, y: 5 });
    expect(result.current.overlay!.poses.get('b')).toEqual({ x: 15, y: 15 });
    act(() => result.current.end());
    expect(adapter.store.get('a')!.pose).toEqual({ x: 5, y: 5 });
    expect(adapter.store.get('b')!.pose).toEqual({ x: 15, y: 15 });
    expect(adapter.batches[0].ops.length).toBe(2);
  });

  it('expandIds returning [] aborts the gesture cleanly', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: null }]);
    const { result } = renderHook(() =>
      useMoveInteraction(adapter, { translatePose, expandIds: () => [] }),
    );
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    expect(
      result.current.move({ worldX: 5, worldY: 5, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }),
    ).toBe(false);
    act(() => result.current.end());
    expect(adapter.batches).toEqual([]);
    expect(result.current.overlay).toBeNull();
  });

  it('cascades structurally-grouped descendants in the overlay (translated world poses, hidden in live render, no extra ops)', () => {
    // Scene: g (root), child a parented to g, grandchild b parented to a.
    // Poses are local. World of a = (10+1, 20+2) = (11, 22). World of b = (11+0, 22+5) = (11, 27).
    const adapter = makeAdapter([
      { id: 'g', pose: { x: 10, y: 20 }, parent: null },
      { id: 'a', pose: { x: 1,  y: 2  }, parent: 'g' },
      { id: 'b', pose: { x: 0,  y: 5  }, parent: 'a' },
    ]);
    adapter.getChildren = (id: string) =>
      [...adapter.store.values()].filter((o) => o.parent === id).map((o) => o.id);

    // Standalone world-pose lookup for the test (translation-only compose).
    const worldOf = (id: string): Pose | null => {
      const o = adapter.store.get(id);
      if (!o) return null;
      let world = { ...o.pose };
      let p = o.parent;
      while (p !== null) {
        const pp = adapter.store.get(p)!;
        world = { ...world, x: world.x + pp.pose.x, y: world.y + pp.pose.y };
        p = pp.parent;
      }
      return world;
    };

    const { result } = renderHook(() =>
      useMoveInteraction(adapter, { translatePose, cascadeWorldPose: worldOf }),
    );
    act(() => result.current.start({ ids: ['g'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 100, worldY: 200, clientX: 100, clientY: 200, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));

    // Overlay carries g (in its parent's frame, here root → world) translated by (100, 200).
    expect(result.current.overlay!.poses.get('g')).toEqual({ x: 110, y: 220 });
    // a and b are cascaded: their original world poses translated by (100, 200).
    expect(result.current.overlay!.poses.get('a')).toEqual({ x: 111, y: 222 });
    expect(result.current.overlay!.poses.get('b')).toEqual({ x: 111, y: 227 });
    // Live render hides all three so the overlay's ghosts aren't doubled.
    expect(result.current.overlay!.hideIds).toEqual(['g', 'a', 'b']);
    // Dragged set is unchanged — cascade is overlay-only.
    expect(result.current.overlay!.draggedIds).toEqual(['g']);

    act(() => result.current.end());
    // Only one transform op for the dragged id; children cascade for free in scene.
    expect(adapter.batches.length).toBe(1);
    expect(adapter.batches[0].ops.length).toBe(1);
    expect(adapter.store.get('g')!.pose).toEqual({ x: 110, y: 220 });
    expect(adapter.store.get('a')!.pose).toEqual({ x: 1, y: 2 }); // local unchanged
    expect(adapter.store.get('b')!.pose).toEqual({ x: 0, y: 5 }); // local unchanged
  });

  it('overlay reflects in-flight pose; cleared on end', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: null }]);
    const { result } = renderHook(() => useMoveInteraction(adapter, { translatePose }));
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 5, worldY: 5, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    expect(result.current.overlay).not.toBeNull();
    expect(result.current.overlay!.poses.get('a')).toEqual({ x: 5, y: 5 });
    act(() => result.current.end());
    expect(result.current.overlay).toBeNull();
  });
});
