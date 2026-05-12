import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDistribute } from './distribute';
import type { DistributeAdapter } from './distribute';
import type { Op } from 'core/ops/types';
import { type NodeId } from 'core/scene/types';
import { pathPoseDescriptor } from 'features/paths/poseDescriptor';
import { polygonFromPoints } from 'features/paths/builder';
import type { Path } from 'features/paths/types';

interface RectPose { x: number; y: number; width: number; height: number; tag?: string }

function makeRectAdapter(initial: string[] = [], poses: Record<string, RectPose> = {}) {
  const selection: NodeId[] = [...initial] as NodeId[];
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: DistributeAdapter<RectPose> = {
    getSelection: () => selection,
    getPose: (id) => poses[id] ?? { x: 0, y: 0, width: 0, height: 0 },
    applyOps: (ops, label) => { batches.push({ ops, label: label ?? '' }); },
  };
  return { adapter, batches };
}

function applyOp<T>(op: Op): { id: string; pose: T } {
  let captured = { id: '', pose: undefined as unknown as T };
  op.apply({ setPose: (id: string, pose: T) => { captured = { id, pose }; } });
  return captured;
}

describe('useDistribute', () => {
  it('empty selection: no-op', () => {
    const helpers = makeRectAdapter([]);
    const { result } = renderHook(() => useDistribute(helpers.adapter));
    act(() => { result.current.distribute('x'); });
    expect(helpers.batches).toEqual([]);
  });

  it('two items: no-op (need >= 3)', () => {
    const helpers = makeRectAdapter(['a', 'b'], {
      a: { x: 0,  y: 0, width: 10, height: 10 },
      b: { x: 50, y: 0, width: 10, height: 10 },
    });
    const { result } = renderHook(() => useDistribute(helpers.adapter));
    act(() => { result.current.distribute('x'); });
    expect(helpers.batches).toEqual([]);
  });

  it('three items, equal sizes, centers mode: middle moves to midpoint', () => {
    const helpers = makeRectAdapter(['a', 'b', 'c'], {
      a: { x: 0,  y: 0, width: 10, height: 10 },
      b: { x: 30, y: 0, width: 10, height: 10 },  // center 35; should be 50
      c: { x: 90, y: 0, width: 10, height: 10 },  // center 95
    });
    const { result } = renderHook(() => useDistribute(helpers.adapter));
    act(() => { result.current.distribute('x', 'centers'); });
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].label).toBe('Distribute');
    expect(helpers.batches[0].ops).toHaveLength(1);
    const moved = applyOp<RectPose>(helpers.batches[0].ops[0]);
    expect(moved.id).toBe('b');
    // target center = (5 + 95)/2 = 50, so x = 45.
    expect(moved.pose.x).toBeCloseTo(45);
  });

  it('endpoints stay put (centers)', () => {
    const helpers = makeRectAdapter(['a', 'b', 'c'], {
      a: { x: 0,   y: 0, width: 10, height: 10 },
      b: { x: 30,  y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    });
    const { result } = renderHook(() => useDistribute(helpers.adapter));
    act(() => { result.current.distribute('x', 'centers'); });
    const movedIds = helpers.batches[0].ops.map((op) => applyOp<RectPose>(op).id);
    expect(movedIds).not.toContain('a');
    expect(movedIds).not.toContain('c');
  });

  it('mixed sizes, gaps mode: gap between AABBs is equal', () => {
    const helpers = makeRectAdapter(['a', 'b', 'c'], {
      a: { x: 0,   y: 0, width: 10, height: 10 },  // [0..10]
      b: { x: 50,  y: 0, width: 30, height: 10 },  // [50..80]; widths matter
      c: { x: 100, y: 0, width: 10, height: 10 },  // [100..110]
    });
    // span = 110 - 0 = 110; sumSizes = 10+30+10 = 50; gap = (110-50)/2 = 30.
    // a stays at 0..10, b should be at 40..70, c at 100..110.
    const { result } = renderHook(() => useDistribute(helpers.adapter));
    act(() => { result.current.distribute('x', 'gaps'); });
    expect(helpers.batches[0].ops).toHaveLength(1);
    const moved = applyOp<RectPose>(helpers.batches[0].ops[0]);
    expect(moved.id).toBe('b');
    expect(moved.pose.x).toBeCloseTo(40);
  });

  it('mixed sizes, centers mode: centers spaced equally regardless of size', () => {
    const helpers = makeRectAdapter(['a', 'b', 'c'], {
      a: { x: 0,   y: 0, width: 10, height: 10 },  // c=5
      b: { x: 40,  y: 0, width: 30, height: 10 },  // c=55 -> should become c=52.5
      c: { x: 90,  y: 0, width: 10, height: 10 },  // c=95... wait recompute
    });
    // c0=5, cN=95. stride = (95-5)/2 = 45. b's target center = 5+45 = 50; x = 50 - 15 = 35.
    const { result } = renderHook(() => useDistribute(helpers.adapter));
    act(() => { result.current.distribute('x', 'centers'); });
    const moved = applyOp<RectPose>(helpers.batches[0].ops[0]);
    expect(moved.id).toBe('b');
    expect(moved.pose.x).toBeCloseTo(35);
  });

  it('y-axis distribution distributes vertically and ignores x', () => {
    const helpers = makeRectAdapter(['a', 'b', 'c'], {
      a: { x: 0, y: 0,   width: 10, height: 10 },  // c=5
      b: { x: 5, y: 30,  width: 10, height: 10 },  // should center at 50 -> y=45
      c: { x: 9, y: 90,  width: 10, height: 10 },  // c=95
    });
    const { result } = renderHook(() => useDistribute(helpers.adapter));
    act(() => { result.current.distribute('y', 'centers'); });
    const moved = applyOp<RectPose>(helpers.batches[0].ops[0]);
    expect(moved.id).toBe('b');
    expect(moved.pose.y).toBeCloseTo(45);
    // x stays the same.
    expect(moved.pose.x).toBe(5);
  });

  it('items already evenly spaced: no-op (no batch)', () => {
    const helpers = makeRectAdapter(['a', 'b', 'c'], {
      a: { x: 0,  y: 0, width: 10, height: 10 },
      b: { x: 50, y: 0, width: 10, height: 10 },  // centers: 5, 55, 105 -> stride 50
      c: { x: 100, y: 0, width: 10, height: 10 },
    });
    const { result } = renderHook(() => useDistribute(helpers.adapter));
    act(() => { result.current.distribute('x', 'centers'); });
    expect(helpers.batches).toEqual([]);
  });

  it('unsorted input is sorted by axis before distributing', () => {
    // Selection in reverse order; verify b ends up at the middle.
    const helpers = makeRectAdapter(['c', 'b', 'a'], {
      a: { x: 0,   y: 0, width: 10, height: 10 },
      b: { x: 30,  y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    });
    const { result } = renderHook(() => useDistribute(helpers.adapter));
    act(() => { result.current.distribute('x', 'centers'); });
    const moved = applyOp<RectPose>(helpers.batches[0].ops[0]);
    expect(moved.id).toBe('b');
    // a center = 5, c center = 105 -> b should be at 55 -> x=50.
    expect(moved.pose.x).toBeCloseTo(50);
  });

  it('inverse op restores original pose (one undo step)', () => {
    const helpers = makeRectAdapter(['a', 'b', 'c'], {
      a: { x: 0,   y: 0, width: 10, height: 10 },
      b: { x: 30,  y: 0, width: 10, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    });
    const { result } = renderHook(() => useDistribute(helpers.adapter));
    act(() => { result.current.distribute('x'); });
    const op = helpers.batches[0].ops[0];
    const before = applyOp<RectPose>(op.invert!()).pose;
    expect(before).toMatchObject({ x: 30, y: 0, width: 10, height: 10 });
  });

  it('custom label flows through', () => {
    const helpers = makeRectAdapter(['a', 'b', 'c'], {
      a: { x: 0,  y: 0, width: 10, height: 10 },
      b: { x: 30, y: 0, width: 10, height: 10 },
      c: { x: 90, y: 0, width: 10, height: 10 },
    });
    const { result } = renderHook(() => useDistribute(helpers.adapter, { label: 'Spread' }));
    act(() => { result.current.distribute('x'); });
    expect(helpers.batches[0].label).toBe('Spread');
  });

  it('defaultMode is honored when distribute is called without mode', () => {
    const helpers = makeRectAdapter(['a', 'b', 'c'], {
      a: { x: 0,   y: 0, width: 10, height: 10 },
      b: { x: 50,  y: 0, width: 30, height: 10 },
      c: { x: 100, y: 0, width: 10, height: 10 },
    });
    const { result } = renderHook(() => useDistribute(helpers.adapter, { defaultMode: 'gaps' }));
    act(() => { result.current.distribute('x'); });
    const moved = applyOp<RectPose>(helpers.batches[0].ops[0]);
    expect(moved.id).toBe('b');
    expect(moved.pose.x).toBeCloseTo(40);
  });

  it('polygon poses (path geometry): centers mode distributes AABB centers', () => {
    const a: Path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]);
    // bounds 0..10
    const b: Path = polygonFromPoints([{ x: 30, y: 0 }, { x: 40, y: 0 }, { x: 30, y: 10 }]);
    // bounds 30..40, center=35; target center = 50 -> shift by +15
    const c: Path = polygonFromPoints([{ x: 90, y: 0 }, { x: 100, y: 0 }, { x: 90, y: 10 }]);
    // bounds 90..100, center=95
    const selection: NodeId[] = ['a', 'b', 'c'] as NodeId[];
    const batches: { ops: Op[]; label: string }[] = [];
    const adapter: DistributeAdapter<Path> = {
      getSelection: () => selection,
      getPose: (id) => (id === 'a' ? a : id === 'b' ? b : c),
      applyOps: (ops, label) => batches.push({ ops, label: label ?? '' }),
    };
    const { result } = renderHook(() => useDistribute<Path>(adapter, { geometry: pathPoseDescriptor }));
    act(() => { result.current.distribute('x', 'centers'); });
    expect(batches).toHaveLength(1);
    const moved = applyOp<Path>(batches[0].ops[0]).pose;
    const bb = pathPoseDescriptor.getBounds(moved);
    // new center should be 50.
    expect(bb.x + bb.width / 2).toBeCloseTo(50);
  });

  it('distribute identity stable across renders', () => {
    const helpers = makeRectAdapter(['a', 'b', 'c'], {
      a: { x: 0, y: 0, width: 1, height: 1 },
      b: { x: 1, y: 0, width: 1, height: 1 },
      c: { x: 5, y: 0, width: 1, height: 1 },
    });
    const { result, rerender } = renderHook(() => useDistribute(helpers.adapter));
    const f0 = result.current.distribute;
    rerender();
    expect(result.current.distribute).toBe(f0);
  });
});
