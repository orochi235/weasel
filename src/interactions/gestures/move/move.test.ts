import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMove } from './move';
import { snapToGrid } from './behaviors/snapToGrid';
import { snapBackOrDelete } from './behaviors/snapBackOrDelete';
import { snap } from '../shared/snap';
import { gridSnapStrategy } from '../shared/strategies/grid';
import type { MoveBehavior } from '../types';
import type { MoveAdapter } from 'core/adapters/types';
import type { Op } from 'core/ops/types';
import type { BeginSpec } from '../../../tools/routing';
import type { MoveScratchTag } from './move';

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
    getNode: (id) => store.get(id),
    getNodes: () => Array.from(store.values()),
    getPose: (id) => store.get(id)!.pose,
    getParent: (id) => store.get(id)!.parent,
    setPose: (id, pose) => {
      store.get(id)!.pose = { ...pose };
    },
    setParent: (id, parent) => {
      store.get(id)!.parent = parent;
    },
    applyOps: (ops, label) => {
      for (const op of ops) op.apply({
        setPose: (id: string, pose: Pose) => { store.get(id)!.pose = { ...pose }; },
        setParent: (id: string, p: string | null) => { store.get(id)!.parent = p; },
        insertNode: (o: Obj) => store.set(o.id, o),
        removeNode: (id: string) => store.delete(id),
      });
      batches.push({ ops, label });
    },
  };
}

const translatePose = (p: Pose, dx: number, dy: number) => ({ ...p, x: p.x + dx, y: p.y + dy });

describe('useMove', () => {
  it('does not commit before threshold is exceeded', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: null }]);
    const { result } = renderHook(() => useMove(adapter, { translatePose }));
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 0.05, worldY: 0.05, clientX: 1, clientY: 1, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());
    expect(adapter.batches).toEqual([]);
  });

  it('emits a default TransformOp batch when moved past threshold', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: null }]);
    const { result } = renderHook(() => useMove(adapter, { translatePose, dragThresholdPx: 4 }));
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 5, worldY: 5, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());
    expect(adapter.batches.length).toBe(1);
    expect(adapter.store.get('a')!.pose).toEqual({ x: 5, y: 5 });
  });

  it('snapToGrid behavior rounds the proposed pose', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: null }]);
    const { result } = renderHook(() =>
      useMove(adapter, { translatePose, behaviors: [snapToGrid<Pose>({ spacing: 1 })] }),
    );
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 5.4, worldY: 5.6, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());
    expect(adapter.store.get('a')!.pose).toEqual({ x: 5, y: 6 });
  });

  it('multi-select translate with snap(gridSnap) keeps relative offsets constant across drags (group-transform contract)', () => {
    // Regression for the "divide → drag → sliver detaches" bug. Before the
    // group-transform migration, behaviors returned a primary-only `pose`;
    // the gesture moved the primary onto the grid and let secondaries follow
    // the raw cursor delta, so the selection drifted apart over successive
    // drags. The contract now applies a single `translate` transform to
    // every dragged id, so the relative offset is invariant.
    const adapter = makeAdapter([
      { id: 'a', pose: { x: 0,  y: 0  }, parent: null },
      { id: 'b', pose: { x: 7,  y: 13 }, parent: null }, // off-grid sibling
      { id: 'c', pose: { x: 23, y: 41 }, parent: null }, // another off-grid sibling
    ]);
    const { result } = renderHook(() =>
      useMove(adapter, {
        translatePose,
        behaviors: [snap(gridSnapStrategy<Pose>(20))],
      }),
    );

    // Drag 1: cursor lands at (24, 27). Grid spacing 20 → primary 'a' snaps
    // to (20, 20). Expected delta = (20, 20). Secondaries shift by same.
    act(() => result.current.start({ ids: ['a', 'b', 'c'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 24, worldY: 27, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());

    expect(adapter.store.get('a')!.pose).toEqual({ x: 20, y: 20 });
    expect(adapter.store.get('b')!.pose).toEqual({ x: 27, y: 33 });
    expect(adapter.store.get('c')!.pose).toEqual({ x: 43, y: 61 });
    // Relative offsets b→a, c→a preserved.
    expect(adapter.store.get('b')!.pose.x - adapter.store.get('a')!.pose.x).toBe(7);
    expect(adapter.store.get('b')!.pose.y - adapter.store.get('a')!.pose.y).toBe(13);
    expect(adapter.store.get('c')!.pose.x - adapter.store.get('a')!.pose.x).toBe(23);
    expect(adapter.store.get('c')!.pose.y - adapter.store.get('a')!.pose.y).toBe(41);

    // Drag 2: from new positions, another off-grid cursor delta.
    const aBefore = { ...adapter.store.get('a')!.pose };
    act(() => result.current.start({ ids: ['a', 'b', 'c'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 18, worldY: 11, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());

    // Primary 'a' at (20,20); cursor delta (18, 11) → proposed (38, 31) →
    // grid-snapped to (40, 40), so absolute delta on this drag = (20, 20).
    expect(adapter.store.get('a')!.pose).toEqual({ x: aBefore.x + 20, y: aBefore.y + 20 });
    // Offsets STILL preserved — this is the load-bearing assertion.
    expect(adapter.store.get('b')!.pose.x - adapter.store.get('a')!.pose.x).toBe(7);
    expect(adapter.store.get('b')!.pose.y - adapter.store.get('a')!.pose.y).toBe(13);
    expect(adapter.store.get('c')!.pose.x - adapter.store.get('a')!.pose.x).toBe(23);
    expect(adapter.store.get('c')!.pose.y - adapter.store.get('a')!.pose.y).toBe(41);
  });

  it('legacy behaviors returning { pose } still work via the back-compat shim', () => {
    // A pre-migration MoveBehavior shape — returns the legacy `pose` field
    // instead of `transform`. The gesture's shim derives a `translate`
    // transform from `pose.{x,y} - originPose.{x,y}` and applies it to
    // every dragged id (so a legacy snap behavior in multi-select doesn't
    // reintroduce the drift bug).
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const legacy: MoveBehavior<Pose> = {
      onMove(_ctx, transform) {
        // Pretend to do something pose-shaped: snap proposed pose to (10, 10).
        // The shim should derive delta = (10 - origin.x, 10 - origin.y).
        if (transform.kind !== 'translate') return;
        return { pose: { x: 10, y: 10 } };
      },
    };
    const adapter = makeAdapter([
      { id: 'a', pose: { x: 0, y: 0  }, parent: null },
      { id: 'b', pose: { x: 3, y: 4  }, parent: null },
    ]);
    const { result } = renderHook(() =>
      useMove(adapter, { translatePose, behaviors: [legacy] }),
    );
    act(() => result.current.start({ ids: ['a', 'b'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 5, worldY: 5, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    act(() => result.current.end());
    // Primary 'a' moved to (10, 10) → delta (10, 10). Secondary 'b' must
    // shift by the SAME delta.
    expect(adapter.store.get('a')!.pose).toEqual({ x: 10, y: 10 });
    expect(adapter.store.get('b')!.pose).toEqual({ x: 13, y: 14 });
    // Shim must not surface any warnings at the test level.
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('snapBackOrDelete with delete policy emits DeleteOp when far from origin', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: 'p' }]);
    const { result } = renderHook(() =>
      useMove(adapter, {
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
      useMove(adapter, {
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
    const { result } = renderHook(() => useMove(adapter, { translatePose }));
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
    const { result } = renderHook(() => useMove(adapter, { translatePose, expandIds }));
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
      useMove(adapter, { translatePose, expandIds: () => [] }),
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
      useMove(adapter, { translatePose, cascadeWorldPose: worldOf }),
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
    const { result } = renderHook(() => useMove(adapter, { translatePose }));
    act(() => result.current.start({ ids: ['a'], worldX: 0, worldY: 0, clientX: 0, clientY: 0 }));
    act(() => result.current.move({ worldX: 5, worldY: 5, clientX: 100, clientY: 100, modifiers: { alt: false, shift: false, meta: false, ctrl: false } }));
    expect(result.current.overlay).not.toBeNull();
    expect(result.current.overlay!.poses.get('a')).toEqual({ x: 5, y: 5 });
    act(() => result.current.end());
    expect(result.current.overlay).toBeNull();
  });
});

describe('useMove.beginAt', () => {
  it('returns a begin Result with continuation closures', () => {
    const adapter = makeAdapter([
      { id: 'a', pose: { x: 0, y: 0 }, parent: null },
      { id: 'b', pose: { x: 10, y: 10 }, parent: null },
    ]);
    const { result } = renderHook(() => useMove(adapter, { translatePose }));

    const fakeCtx = {
      worldX: 10,
      worldY: 20,
      screenPoint: { x: 100, y: 200 },
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    } as never;

    let r: ReturnType<typeof result.current.beginAt>;
    act(() => { r = result.current.beginAt(fakeCtx, ['a', 'b']); });

    expect(r!.kind).toBe('begin');
    const spec = (r! as { kind: 'begin'; spec: BeginSpec<MoveScratchTag> }).spec;
    expect(spec.scratch).toEqual({ kind: 'move', ids: ['a', 'b'] });
    expect(spec.onMove).toBeDefined();
    expect(spec.onRelease).toBeDefined();
    expect(spec.onCancel).toBeDefined();
  });

  it('onMove continuation drives the gesture and returns hold', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: null }]);
    const { result } = renderHook(() => useMove(adapter, { translatePose, dragThresholdPx: 4 }));

    const startCtx = {
      worldX: 0,
      worldY: 0,
      screenPoint: { x: 0, y: 0 },
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    } as never;

    let r: ReturnType<typeof result.current.beginAt>;
    act(() => { r = result.current.beginAt(startCtx, ['a']); });

    if (r!.kind !== 'begin') throw new Error('expected begin');
    const beginSpec = (r! as { kind: 'begin'; spec: BeginSpec<MoveScratchTag> }).spec;

    const moveCtx = {
      worldX: 5,
      worldY: 5,
      screenPoint: { x: 100, y: 100 },
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
      scratch: { kind: 'move' as const, ids: ['a'] as readonly string[] },
    } as never;

    let moveResult: ReturnType<NonNullable<BeginSpec<MoveScratchTag>['onMove']>>;
    act(() => { moveResult = beginSpec.onMove!(moveCtx); });

    expect(moveResult!.kind).toBe('hold');
  });

  it('onRelease continuation ends the gesture and returns cancel', () => {
    const adapter = makeAdapter([{ id: 'a', pose: { x: 0, y: 0 }, parent: null }]);
    const { result } = renderHook(() => useMove(adapter, { translatePose, dragThresholdPx: 4 }));

    const startCtx = {
      worldX: 0,
      worldY: 0,
      screenPoint: { x: 0, y: 0 },
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
    } as never;

    let r: ReturnType<typeof result.current.beginAt>;
    act(() => { r = result.current.beginAt(startCtx, ['a']); });

    if (r!.kind !== 'begin') throw new Error('expected begin');
    const beginSpec = (r! as { kind: 'begin'; spec: BeginSpec<MoveScratchTag> }).spec;

    const releaseCtx = {
      worldX: 5,
      worldY: 5,
      screenPoint: { x: 100, y: 100 },
      modifiers: { alt: false, shift: false, meta: false, ctrl: false, space: false },
      scratch: { kind: 'move' as const, ids: ['a'] as readonly string[] },
    } as never;

    let releaseResult: ReturnType<NonNullable<BeginSpec<MoveScratchTag>['onRelease']>>;
    act(() => { releaseResult = beginSpec.onRelease!(releaseCtx); });

    expect(releaseResult!.kind).toBe('cancel');
  });
});
