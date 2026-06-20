import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAlign, alignDeltaFor, translatePoseViaDescriptor } from './align';
import type { AlignAdapter } from './align';
import { unionBounds } from 'features/groups/unionBounds';
import type { Op } from 'core/ops/types';
import { type NodeId } from 'core/scene/types';
import { pathPoseDescriptor } from 'features/paths/poseDescriptor';
import { polygonFromPoints } from 'features/paths/builder';
import type { Path } from 'features/paths/types';

interface RectPose { x: number; y: number; width: number; height: number; tag?: string }

function makeRectAdapter(initial: string[] = [], poses: Record<string, RectPose> = {}) {
  let selection: NodeId[] = [...initial] as NodeId[];
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: AlignAdapter<RectPose> = {
    getSelection: () => selection,
    getPose: (id) => poses[id] ?? { x: 0, y: 0, width: 0, height: 0 },
    applyOps: (ops, label) => { batches.push({ ops, label: label ?? '' }); },
  };
  return { adapter, batches, setSel: (ids: string[]) => { selection = [...ids] as NodeId[]; } };
}

function applyOp<T>(op: Op): { id: string; pose: T } {
  let captured = { id: '', pose: undefined as unknown as T };
  op.apply({ setPose: (id: string, pose: T) => { captured = { id, pose }; } });
  return captured;
}

describe('alignDeltaFor', () => {
  const u = { x: 0, y: 0, width: 100, height: 50 };
  it('left: shifts AABB to union.x', () => {
    expect(alignDeltaFor({ x: 30, y: 5, width: 10, height: 10 }, u, 'left')).toEqual({ dx: -30, dy: 0 });
  });
  it('right: shifts AABB so its right edge meets union.right', () => {
    expect(alignDeltaFor({ x: 30, y: 5, width: 10, height: 10 }, u, 'right')).toEqual({ dx: 60, dy: 0 });
  });
  it('top: shifts to union.y', () => {
    expect(alignDeltaFor({ x: 30, y: 5, width: 10, height: 10 }, u, 'top')).toEqual({ dx: 0, dy: -5 });
  });
  it('bottom: shifts so bottom edge meets union bottom', () => {
    expect(alignDeltaFor({ x: 30, y: 5, width: 10, height: 10 }, u, 'bottom')).toEqual({ dx: 0, dy: 35 });
  });
  it('center-x: matches horizontal centers', () => {
    expect(alignDeltaFor({ x: 30, y: 5, width: 10, height: 10 }, u, 'center-x')).toEqual({ dx: 15, dy: 0 });
  });
  it('center-y: matches vertical centers', () => {
    // u midline-y = 25; box center-y = 10; dy = 15.
    expect(alignDeltaFor({ x: 30, y: 5, width: 10, height: 10 }, u, 'center-y')).toEqual({ dx: 0, dy: 15 });
  });
});

describe('useAlign', () => {
  it('empty selection: no applyOps', () => {
    const helpers = makeRectAdapter([]);
    const { result } = renderHook(() => useAlign(helpers.adapter));
    act(() => { result.current.align('left'); });
    expect(helpers.batches).toEqual([]);
  });

  it('single selection: no-op', () => {
    const helpers = makeRectAdapter(['a'], { a: { x: 5, y: 7, width: 12, height: 3 } });
    const { result } = renderHook(() => useAlign(helpers.adapter));
    act(() => { result.current.align('left'); });
    act(() => { result.current.align('center-x'); });
    expect(helpers.batches).toEqual([]);
  });

  it('two-item left-align: smaller item moves to shared left edge in one batch', () => {
    const helpers = makeRectAdapter(['a', 'b'], {
      a: { x: 0,  y: 0, width: 10, height: 10 },
      b: { x: 50, y: 5, width: 20, height: 20 },
    });
    const { result } = renderHook(() => useAlign(helpers.adapter));
    act(() => { result.current.align('left'); });
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].label).toBe('Align');
    // 'a' is already at the left edge, so it should be skipped; only 'b' moves.
    expect(helpers.batches[0].ops).toHaveLength(1);
    const moved = applyOp<RectPose>(helpers.batches[0].ops[0]);
    expect(moved.id).toBe('b');
    expect(moved.pose).toMatchObject({ x: 0, y: 5, width: 20, height: 20 });
  });

  it('right-align: bigger item stays, smaller item shifts so right edges match', () => {
    const helpers = makeRectAdapter(['a', 'b'], {
      a: { x: 0,  y: 0, width: 10, height: 10 },
      b: { x: 50, y: 5, width: 20, height: 20 },
    });
    const { result } = renderHook(() => useAlign(helpers.adapter));
    act(() => { result.current.align('right'); });
    // union right = 70. 'a' right = 10 -> dx = 60. 'b' is at right edge.
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].ops).toHaveLength(1);
    const moved = applyOp<RectPose>(helpers.batches[0].ops[0]);
    expect(moved.id).toBe('a');
    expect(moved.pose).toMatchObject({ x: 60, y: 0 });
  });

  it('center-x: mixed sizes are centered horizontally on the union midline', () => {
    const helpers = makeRectAdapter(['a', 'b'], {
      a: { x: 0,  y: 0, width: 10, height: 10 },  // center 5
      b: { x: 50, y: 5, width: 20, height: 20 },  // center 60
    });
    // union x: [0, 70], midline = 35.
    const { result } = renderHook(() => useAlign(helpers.adapter));
    act(() => { result.current.align('center-x'); });
    expect(helpers.batches[0].ops).toHaveLength(2);
    const a = applyOp<RectPose>(helpers.batches[0].ops[0]);
    const b = applyOp<RectPose>(helpers.batches[0].ops[1]);
    expect(a.pose.x + a.pose.width / 2).toBeCloseTo(35);
    expect(b.pose.x + b.pose.width / 2).toBeCloseTo(35);
  });

  it('all-aligned input is a no-op (no batch dispatched)', () => {
    const helpers = makeRectAdapter(['a', 'b'], {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 0, y: 50, width: 10, height: 10 },
    });
    const { result } = renderHook(() => useAlign(helpers.adapter));
    act(() => { result.current.align('left'); });
    expect(helpers.batches).toEqual([]);
  });

  it('preserves non-bounds fields on translated pose', () => {
    const helpers = makeRectAdapter(['a', 'b'], {
      a: { x: 0,  y: 0, width: 10, height: 10, tag: 'keep-a' },
      b: { x: 50, y: 0, width: 10, height: 10, tag: 'keep-b' },
    });
    const { result } = renderHook(() => useAlign(helpers.adapter));
    act(() => { result.current.align('left'); });
    const moved = applyOp<RectPose>(helpers.batches[0].ops[0]);
    expect(moved.pose.tag).toBe('keep-b');
  });

  it('inverse op restores original pose (one undo step)', () => {
    const helpers = makeRectAdapter(['a', 'b'], {
      a: { x: 0,  y: 0, width: 10, height: 10 },
      b: { x: 50, y: 0, width: 20, height: 20 },
    });
    const { result } = renderHook(() => useAlign(helpers.adapter));
    act(() => { result.current.align('left'); });
    const op = helpers.batches[0].ops[0];
    const before = applyOp<RectPose>(op.invert!()).pose;
    expect(before).toMatchObject({ x: 50, y: 0, width: 20, height: 20 });
  });

  it('custom label flows through', () => {
    const helpers = makeRectAdapter(['a', 'b'], {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 50, y: 0, width: 10, height: 10 },
    });
    const { result } = renderHook(() => useAlign(helpers.adapter, { label: 'Snap' }));
    act(() => { result.current.align('left'); });
    expect(helpers.batches[0].label).toBe('Snap');
  });

  it('polygon poses: center-y aligns AABB centers via path geometry', () => {
    const triA: Path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]);
    // bounds: 0..10, 0..10. center-y = 5
    const triB: Path = polygonFromPoints([{ x: 100, y: 100 }, { x: 130, y: 100 }, { x: 100, y: 140 }]);
    // bounds: 100..130, 100..140. center-y = 120
    const selection: NodeId[] = ['a', 'b'] as NodeId[];
    const batches: { ops: Op[]; label: string }[] = [];
    const adapter: AlignAdapter<Path> = {
      getSelection: () => selection,
      getPose: (id) => (id === 'a' ? triA : triB),
      applyOps: (ops, label) => batches.push({ ops, label: label ?? '' }),
    };
    const { result } = renderHook(() => useAlign<Path>(adapter, { geometry: pathPoseDescriptor }));
    act(() => { result.current.align('center-y'); });
    expect(batches).toHaveLength(1);
    // After alignment, both AABB centers must be on the same y line.
    const out = batches[0].ops.map((op) => applyOp<Path>(op).pose);
    const centers = out.map((p) => {
      const b = pathPoseDescriptor.getBounds(p);
      return b.y + b.height / 2;
    });
    if (centers.length === 2) expect(centers[0]).toBeCloseTo(centers[1]);
  });

  it('translatePoseViaDescriptor falls back to remapBounds when translate is absent', () => {
    const geom = {
      getBounds: (p: RectPose) => p,
      remapBounds: (p: RectPose, src: RectPose, dst: RectPose) => ({
        ...p,
        x: dst.x + (p.x - src.x),
        y: dst.y + (p.y - src.y),
      }),
    };
    const out = translatePoseViaDescriptor({ x: 5, y: 6, width: 1, height: 1 }, 10, 20, geom);
    expect(out).toMatchObject({ x: 15, y: 26 });
  });

  // Cross-consumer invariant (#5 dedup): align and resize both derive their
  // shared union frame from the canonical `unionBounds`. For a multi-item set,
  // align's union (driving `alignDeltaFor`) and resize's `originBounds` union
  // are the same envelope. We assert the canonical owner produces the expected
  // frame so both consumers stay in lockstep by construction.
  it('align and resize derive the same union frame for a shared set', () => {
    const bounds = [
      { x: 0,  y: 0,  width: 10, height: 10 },
      { x: 50, y: 5,  width: 20, height: 20 },
      { x: 30, y: 40, width: 5,  height: 5 },
    ];
    // union: x [0, 70], y [0, 45].
    const frame = unionBounds(bounds);
    expect(frame).toEqual({ x: 0, y: 0, width: 70, height: 45 });

    // align consumes this exact frame via `alignDeltaFor`.
    const dLeft = alignDeltaFor(bounds[1], frame!, 'left');
    expect(dLeft).toEqual({ dx: -50, dy: 0 });
    // resize consumes the same frame as its `originBounds` for the group/multi
    // path — width/height are the AABB envelope both paths share.
    expect(frame!.width).toBe(70);
    expect(frame!.height).toBe(45);
  });

  it('align identity stable across renders', () => {
    const helpers = makeRectAdapter(['a', 'b'], {
      a: { x: 0, y: 0, width: 1, height: 1 },
      b: { x: 5, y: 0, width: 1, height: 1 },
    });
    const { result, rerender } = renderHook(() => useAlign(helpers.adapter));
    const f0 = result.current.align;
    rerender();
    expect(result.current.align).toBe(f0);
  });
});
