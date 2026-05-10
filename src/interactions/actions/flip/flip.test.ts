import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFlip, flipPoseAboutBounds, flipPoseViaDescriptor } from './flip';
import type { FlipAdapter } from './flip';
import type { Op } from '../../../core/ops/types';
import { type NodeId } from '../../../core/scene/types';
import { pathPoseDescriptor } from '../../../features/paths/poseDescriptor';
import { PathBuilder, polygonFromPoints } from '../../../features/paths/builder';
import { composePath } from '../../../features/paths/compose';
import type { Path } from '../../../features/paths/types';

interface RectPose { x: number; y: number; width: number; height: number; tag?: string }

function makeRectAdapter(initial: string[] = [], poses: Record<string, RectPose> = {}) {
  let selection: NodeId[] = [...initial] as NodeId[];
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: FlipAdapter<RectPose> = {
    getSelection: () => selection,
    getPose: (id) => poses[id] ?? { x: 0, y: 0, width: 0, height: 0 },
    applyBatch: (ops, label) => { batches.push({ ops, label: label ?? '' }); },
  };
  return { adapter, batches, setSel: (ids: string[]) => { selection = [...ids] as NodeId[]; } };
}

function applyOp<T>(op: Op): { id: string; pose: T } {
  let captured = { id: '', pose: undefined as unknown as T };
  op.apply({ setPose: (id: string, pose: T) => { captured = { id, pose }; } });
  return captured;
}

describe('flipPoseViaDescriptor (rect)', () => {
  it('horizontal flip of a rect at its own bounds is the same rect (canonical)', () => {
    const p: RectPose = { x: 10, y: 20, width: 30, height: 40 };
    const out = flipPoseViaDescriptor(p, 'x', {
      getBounds: (q) => q,
      remapBounds: (q, src, dst) => {
        const sx = src.width === 0 ? 1 : dst.width / src.width;
        const sy = src.height === 0 ? 1 : dst.height / src.height;
        return {
          ...q,
          x: dst.x + (q.x - src.x) * sx,
          y: dst.y + (q.y - src.y) * sy,
          width: q.width * sx,
          height: q.height * sy,
        };
      },
    });
    // After normalization, a rect flipped about its own AABB equals itself.
    expect(out).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('vertical flip of a rect at its own bounds is the same rect', () => {
    const p: RectPose = { x: 10, y: 20, width: 30, height: 40 };
    const out = flipPoseViaDescriptor(p, 'y', {
      getBounds: (q) => q,
      remapBounds: (q, src, dst) => {
        const sx = src.width === 0 ? 1 : dst.width / src.width;
        const sy = src.height === 0 ? 1 : dst.height / src.height;
        return {
          ...q,
          x: dst.x + (q.x - src.x) * sx,
          y: dst.y + (q.y - src.y) * sy,
          width: q.width * sx,
          height: q.height * sy,
        };
      },
    });
    expect(out).toEqual({ x: 10, y: 20, width: 30, height: 40 });
  });

  it('preserves non-bounds fields on the pose', () => {
    const p: RectPose = { x: 10, y: 20, width: 30, height: 40, tag: 'keep' };
    const out = flipPoseViaDescriptor(p, 'x', {
      getBounds: (q) => q,
      remapBounds: (q, src, dst) => {
        const sx = src.width === 0 ? 1 : dst.width / src.width;
        return { ...q, x: dst.x + (q.x - src.x) * sx, width: q.width * sx };
      },
    });
    expect(out.tag).toBe('keep');
  });
});

describe('flipPoseViaDescriptor (path polygon)', () => {
  it('horizontal flip reflects polygon coords across the AABB centerline', () => {
    // Right triangle with hypotenuse on the left. Bounds: x:0,w:10, y:0,h:10.
    // After horizontal flip: hypotenuse on the right; bounds unchanged.
    const tri: Path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]);
    const flipped = flipPoseViaDescriptor(tri, 'x', pathPoseDescriptor);
    expect(flipped.kind).toBe('polygon');
    if (flipped.kind !== 'polygon') return;
    // Original x coords [0, 10, 0] mirror to [10, 0, 10] across cx=5.
    expect(Array.from(flipped.coords)).toEqual([10, 0, 0, 0, 10, 10]);
    // AABB unchanged.
    const b = pathPoseDescriptor.getBounds(flipped);
    expect(b).toMatchObject({ x: 0, y: 0, width: 10, height: 10 });
  });

  it('vertical flip reflects polygon coords across the AABB midline-y', () => {
    const tri: Path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]);
    const flipped = flipPoseViaDescriptor(tri, 'y', pathPoseDescriptor);
    if (flipped.kind !== 'polygon') return;
    // y coords [0, 0, 10] mirror to [10, 10, 0] across cy=5.
    expect(Array.from(flipped.coords)).toEqual([0, 10, 10, 10, 0, 0]);
  });

  it('double-flip is identity (within float tolerance)', () => {
    const tri: Path = polygonFromPoints([{ x: 1, y: 2 }, { x: 9, y: 3 }, { x: 4, y: 8 }]);
    const once = flipPoseViaDescriptor(tri, 'x', pathPoseDescriptor);
    const twice = flipPoseViaDescriptor(once, 'x', pathPoseDescriptor);
    if (twice.kind !== 'polygon' || tri.kind !== 'polygon') return;
    for (let i = 0; i < tri.coords.length; i++) {
      expect(twice.coords[i]).toBeCloseTo(tri.coords[i], 6);
    }
  });
});

describe('flipPoseViaDescriptor (PathBuilder Bezier curves)', () => {
  it('horizontal flip mirrors cubic Bezier control points and on-curve points', () => {
    // Single cubic from (0,0) → (10,0) with control points (2,8) and (8,8).
    // AABB derives from on-curve endpoints + control hull → x:0..10, y:0..8.
    const path = new PathBuilder()
      .moveTo(0, 0)
      .curveTo(2, 8, 8, 8, 10, 0)
      .build();
    const flipped = flipPoseViaDescriptor(path, 'x', pathPoseDescriptor);
    if (flipped.kind !== 'polygon') throw new Error('expected polygon');
    // Across cx = 5: (0,0) → (10,0); (2,8) → (8,8); (8,8) → (2,8); (10,0) → (0,0).
    expect(Array.from(flipped.coords)).toEqual([10, 0, 8, 8, 2, 8, 0, 0]);
    // AABB unchanged.
    const b = pathPoseDescriptor.getBounds(flipped);
    expect(b.x).toBeCloseTo(0, 6);
    expect(b.width).toBeCloseTo(10, 6);
  });

  it('vertical flip mirrors quadratic Bezier control point', () => {
    const path = new PathBuilder()
      .moveTo(0, 0)
      .quadTo(5, 10, 10, 0)
      .build();
    const flipped = flipPoseViaDescriptor(path, 'y', pathPoseDescriptor);
    if (flipped.kind !== 'polygon') throw new Error('expected polygon');
    // AABB y:0..10, cy=5. Original y coords [0, 10, 0] → [10, 0, 10].
    expect(Array.from(flipped.coords)).toEqual([0, 10, 5, 0, 10, 10]);
  });

  it('mixed M/L/C/Q/Z command stream: every coord flipped, commands preserved', () => {
    const path = new PathBuilder()
      .moveTo(0, 0)
      .lineTo(10, 0)
      .curveTo(12, 4, 8, 8, 10, 10)
      .quadTo(5, 12, 0, 10)
      .close()
      .build();
    const flipped = flipPoseViaDescriptor(path, 'x', pathPoseDescriptor);
    if (flipped.kind !== 'polygon') throw new Error('expected polygon');
    // AABB x:0..12 (control point at 12), cx=6.
    // Reflect: (0,0)→(12,0); (10,0)→(2,0); (12,4)→(0,4); (8,8)→(4,8); (10,10)→(2,10);
    //         (5,12)→(7,12); (0,10)→(12,10).
    expect(Array.from(flipped.coords)).toEqual([
      12, 0,
      2, 0,
      0, 4,  4, 8,  2, 10,
      7, 12, 12, 10,
    ]);
    // Command stream preserved verbatim — same shape, just reflected.
    expect(Array.from(flipped.commands)).toEqual(Array.from(path.commands));
  });
});

describe('flipPoseViaDescriptor (composePath multi-contour)', () => {
  it('compound path with two subpaths: every coord across both subpaths is flipped', () => {
    // Outer square + inner triangle hole (evenodd would carve, but for flip
    // the fillRule is irrelevant — we're verifying coord transforms).
    const path = new PathBuilder()
      .setFillRule('evenodd')
      .moveTo(0, 0).lineTo(20, 0).lineTo(20, 20).lineTo(0, 20).close()
      .moveTo(5, 5).lineTo(15, 5).lineTo(10, 15).close()
      .build();
    const flipped = flipPoseViaDescriptor(path, 'x', pathPoseDescriptor);
    if (flipped.kind !== 'polygon') throw new Error('expected polygon');
    // AABB x:0..20, cx=10. Reflect: x' = 20 - x.
    // Outer: 0→20, 20→0, 20→0, 0→20.
    // Inner: 5→15, 15→5, 10→10.
    expect(Array.from(flipped.coords)).toEqual([
      20, 0,  0, 0,  0, 20,  20, 20,
      15, 5,  5, 5,  10, 15,
    ]);
    // fillRule preserved.
    expect(flipped.fillRule).toBe('evenodd');
    // Command stream preserved.
    expect(Array.from(flipped.commands)).toEqual(Array.from(path.commands));
  });

  it('composePath of two leaves: post-compose flip reflects every coord across union AABB', () => {
    // Parent triangle at AABB origin (0,0). Child polyline expressed in
    // parent's local frame; composePath shifts it by parent's origin.
    const parent = new PathBuilder().moveTo(0, 0).lineTo(10, 0).lineTo(0, 10).close().build();
    const childLocal = new PathBuilder().moveTo(0, 0).lineTo(5, 5).build();
    const childWorld = composePath(parent, childLocal);
    // Parent origin is (0,0) so composePath is identity here; but verify the
    // post-compose path still flips correctly through the descriptor.
    const flipped = flipPoseViaDescriptor(childWorld, 'x', pathPoseDescriptor);
    if (flipped.kind !== 'polygon') throw new Error('expected polygon');
    // childWorld coords are [0,0, 5,5]. AABB x:0..5, cx=2.5. Reflect: 0→5, 5→0.
    expect(Array.from(flipped.coords)).toEqual([5, 0, 0, 5]);
  });
});

describe('useFlip', () => {
  it('empty selection: no applyBatch', () => {
    const helpers = makeRectAdapter([]);
    const { result } = renderHook(() => useFlip(helpers.adapter));
    act(() => { result.current.flip('x'); });
    act(() => { result.current.flipHorizontal(); });
    act(() => { result.current.flipVertical(); });
    expect(helpers.batches).toEqual([]);
  });

  it('single rect: emits one op with default label "Flip", canonical pose', () => {
    const helpers = makeRectAdapter(['a'], { a: { x: 5, y: 7, width: 12, height: 3 } });
    const { result } = renderHook(() => useFlip(helpers.adapter));
    act(() => { result.current.flipHorizontal(); });
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].label).toBe('Flip');
    expect(helpers.batches[0].ops).toHaveLength(1);
    const { id, pose } = applyOp<RectPose>(helpers.batches[0].ops[0]);
    expect(id).toBe('a');
    expect(pose).toEqual({ x: 5, y: 7, width: 12, height: 3 });
  });

  it('inverse op restores original pose (one undo step)', () => {
    const helpers = makeRectAdapter(['a'], { a: { x: 1, y: 2, width: 4, height: 8 } });
    const { result } = renderHook(() => useFlip(helpers.adapter));
    act(() => { result.current.flipHorizontal(); });
    const op = helpers.batches[0].ops[0];
    const inverse = op.invert!();
    const before = applyOp<RectPose>(inverse).pose;
    expect(before).toEqual({ x: 1, y: 2, width: 4, height: 8 });
  });

  it('multi-selection: each item flipped about its own AABB in one batch', () => {
    const helpers = makeRectAdapter(['a', 'b'], {
      a: { x: 0, y: 0, width: 10, height: 10 },
      b: { x: 100, y: 100, width: 5, height: 5 },
    });
    const { result } = renderHook(() => useFlip(helpers.adapter));
    act(() => { result.current.flipVertical(); });
    expect(helpers.batches).toHaveLength(1);
    expect(helpers.batches[0].ops).toHaveLength(2);
    expect(applyOp<RectPose>(helpers.batches[0].ops[0]).pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(applyOp<RectPose>(helpers.batches[0].ops[1]).pose).toEqual({ x: 100, y: 100, width: 5, height: 5 });
  });

  it('multi-selection of polygons: each flipped about its own AABB', () => {
    const triA: Path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]);
    const triB: Path = polygonFromPoints([{ x: 20, y: 20 }, { x: 30, y: 20 }, { x: 20, y: 30 }]);
    let selection: NodeId[] = ['a', 'b'] as NodeId[];
    const batches: { ops: Op[]; label: string }[] = [];
    const adapter: FlipAdapter<Path> = {
      getSelection: () => selection,
      getPose: (id) => (id === 'a' ? triA : triB),
      applyBatch: (ops, label) => batches.push({ ops, label: label ?? '' }),
    };
    const { result } = renderHook(() => useFlip<Path>(adapter, { geometry: pathPoseDescriptor }));
    act(() => { result.current.flipHorizontal(); });
    expect(batches).toHaveLength(1);
    expect(batches[0].ops).toHaveLength(2);
    const a = applyOp<Path>(batches[0].ops[0]).pose;
    const b = applyOp<Path>(batches[0].ops[1]).pose;
    if (a.kind !== 'polygon' || b.kind !== 'polygon') throw new Error('expected polygons');
    expect(Array.from(a.coords)).toEqual([10, 0, 0, 0, 10, 10]);
    // Triangle B mirrored about its OWN bounds (x: 20..30 → cx=25).
    expect(Array.from(b.coords)).toEqual([30, 20, 20, 20, 30, 30]);
    void selection;
  });

  it('flip(axis) and flipHorizontal/flipVertical agree', () => {
    const helpers = makeRectAdapter(['a'], { a: { x: 0, y: 0, width: 10, height: 10 } });
    const { result } = renderHook(() => useFlip(helpers.adapter));
    act(() => { result.current.flip('x'); });
    act(() => { result.current.flipHorizontal(); });
    act(() => { result.current.flip('y'); });
    act(() => { result.current.flipVertical(); });
    expect(helpers.batches).toHaveLength(4);
  });

  it('custom label flows through', () => {
    const helpers = makeRectAdapter(['a'], { a: { x: 0, y: 0, width: 1, height: 1 } });
    const { result } = renderHook(() => useFlip(helpers.adapter, { label: 'Mirror' }));
    act(() => { result.current.flipHorizontal(); });
    expect(helpers.batches[0].label).toBe('Mirror');
  });

  it('flip identity stable across renders', () => {
    const helpers = makeRectAdapter(['a'], { a: { x: 0, y: 0, width: 1, height: 1 } });
    const { result, rerender } = renderHook(() => useFlip(helpers.adapter));
    const f0 = result.current.flip;
    rerender();
    expect(result.current.flip).toBe(f0);
  });

  describe('pivot: union', () => {
    it('two rects, horizontal: swap positions across union centerline', () => {
      // Union x: 0..100, cx=50. Rect A at left edge, B at right edge.
      const helpers = makeRectAdapter(['a', 'b'], {
        a: { x: 0, y: 0, width: 10, height: 10 },
        b: { x: 90, y: 0, width: 10, height: 10 },
      });
      const { result } = renderHook(() => useFlip(helpers.adapter, { pivot: 'union' }));
      act(() => { result.current.flipHorizontal(); });
      expect(helpers.batches).toHaveLength(1);
      expect(helpers.batches[0].ops).toHaveLength(2);
      // A reflects to where B was; B reflects to where A was.
      expect(applyOp<RectPose>(helpers.batches[0].ops[0]).pose).toEqual({ x: 90, y: 0, width: 10, height: 10 });
      expect(applyOp<RectPose>(helpers.batches[0].ops[1]).pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    });

    it('two rects, vertical: swap positions across union midline-y', () => {
      const helpers = makeRectAdapter(['a', 'b'], {
        a: { x: 0, y: 0, width: 10, height: 10 },
        b: { x: 0, y: 90, width: 10, height: 10 },
      });
      const { result } = renderHook(() => useFlip(helpers.adapter, { pivot: 'union' }));
      act(() => { result.current.flipVertical(); });
      expect(applyOp<RectPose>(helpers.batches[0].ops[0]).pose).toEqual({ x: 0, y: 90, width: 10, height: 10 });
      expect(applyOp<RectPose>(helpers.batches[0].ops[1]).pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    });

    it('single selection: identical to pivot=each', () => {
      const helpers = makeRectAdapter(['a'], { a: { x: 5, y: 7, width: 12, height: 3 } });
      const { result } = renderHook(() => useFlip(helpers.adapter, { pivot: 'union' }));
      act(() => { result.current.flipHorizontal(); });
      expect(applyOp<RectPose>(helpers.batches[0].ops[0]).pose).toEqual({ x: 5, y: 7, width: 12, height: 3 });
    });

    it('default pivot is "each" (multi-selection mirrors in place)', () => {
      const helpers = makeRectAdapter(['a', 'b'], {
        a: { x: 0, y: 0, width: 10, height: 10 },
        b: { x: 100, y: 0, width: 10, height: 10 },
      });
      const { result } = renderHook(() => useFlip(helpers.adapter));
      act(() => { result.current.flipHorizontal(); });
      // No swap — each rect mirrors about its own AABB (canonical = same).
      expect(applyOp<RectPose>(helpers.batches[0].ops[0]).pose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
      expect(applyOp<RectPose>(helpers.batches[0].ops[1]).pose).toEqual({ x: 100, y: 0, width: 10, height: 10 });
    });

    it('union of polygons: each polygon reflects across union centerline', () => {
      // Triangle A at left of union, triangle B at right. Union x: 0..30, cx=15.
      const triA: Path = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }]);
      const triB: Path = polygonFromPoints([{ x: 20, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }]);
      const selection: NodeId[] = ['a', 'b'] as NodeId[];
      const batches: { ops: Op[]; label: string }[] = [];
      const adapter: FlipAdapter<Path> = {
        getSelection: () => selection,
        getPose: (id) => (id === 'a' ? triA : triB),
        applyBatch: (ops, label) => batches.push({ ops, label: label ?? '' }),
      };
      const { result } = renderHook(() =>
        useFlip<Path>(adapter, { geometry: pathPoseDescriptor, pivot: 'union' }),
      );
      act(() => { result.current.flipHorizontal(); });
      const a = applyOp<Path>(batches[0].ops[0]).pose;
      const b = applyOp<Path>(batches[0].ops[1]).pose;
      if (a.kind !== 'polygon' || b.kind !== 'polygon') throw new Error('expected polygons');
      // A across cx=15: x coords [0, 10, 0] → [30, 20, 30].
      expect(Array.from(a.coords)).toEqual([30, 0, 20, 0, 30, 10]);
      // B across cx=15: x coords [20, 30, 30] → [10, 0, 0].
      expect(Array.from(b.coords)).toEqual([10, 0, 0, 0, 0, 10]);
    });
  });

  describe('flipPoseAboutBounds (explicit pivot)', () => {
    it('reflecting about a pivot to the right shifts a rect to the right', () => {
      // Rect at x:0..10. Pivot at x:20..30 (cx=25). Reflected rect lands at x:40..50.
      const out = flipPoseAboutBounds(
        { x: 0, y: 0, width: 10, height: 10 } as RectPose,
        'x',
        {
          getBounds: (q) => q,
          remapBounds: (q, src, dst) => {
            const sx = src.width === 0 ? 1 : dst.width / src.width;
            return { ...q, x: dst.x + (q.x - src.x) * sx, width: q.width * sx };
          },
        },
        { x: 20, y: 0, width: 10, height: 10 },
      );
      expect(out.x).toBe(40);
      expect(out.width).toBe(10);
    });
  });

  describe('keyboard', () => {
    it('Shift+H fires horizontal flip', () => {
      const helpers = makeRectAdapter(['a'], { a: { x: 5, y: 0, width: 10, height: 10 } });
      renderHook(() => useFlip(helpers.adapter));
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', shiftKey: true, bubbles: true, cancelable: true }));
      });
      expect(helpers.batches).toHaveLength(1);
    });

    it('Shift+V fires vertical flip', () => {
      const helpers = makeRectAdapter(['a'], { a: { x: 5, y: 0, width: 10, height: 10 } });
      renderHook(() => useFlip(helpers.adapter));
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'V', shiftKey: true, bubbles: true, cancelable: true }));
      });
      expect(helpers.batches).toHaveLength(1);
    });

    it('plain h (no shift) does NOT fire', () => {
      const helpers = makeRectAdapter(['a'], { a: { x: 0, y: 0, width: 1, height: 1 } });
      renderHook(() => useFlip(helpers.adapter));
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', bubbles: true, cancelable: true }));
      });
      expect(helpers.batches).toEqual([]);
    });

    it('Mod+Shift+H does NOT fire (avoid clashing with system shortcuts)', () => {
      const helpers = makeRectAdapter(['a'], { a: { x: 0, y: 0, width: 1, height: 1 } });
      renderHook(() => useFlip(helpers.adapter));
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', shiftKey: true, metaKey: true, bubbles: true, cancelable: true }));
      });
      expect(helpers.batches).toEqual([]);
    });

    it('enableKeyboard: false disables binding', () => {
      const helpers = makeRectAdapter(['a'], { a: { x: 0, y: 0, width: 1, height: 1 } });
      renderHook(() => useFlip(helpers.adapter, { enableKeyboard: false }));
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', shiftKey: true, bubbles: true, cancelable: true }));
      });
      expect(helpers.batches).toEqual([]);
    });

    it('listener removed on unmount', () => {
      const helpers = makeRectAdapter(['a'], { a: { x: 0, y: 0, width: 1, height: 1 } });
      const { unmount } = renderHook(() => useFlip(helpers.adapter));
      unmount();
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'H', shiftKey: true, bubbles: true, cancelable: true }));
      });
      expect(helpers.batches).toEqual([]);
    });
  });
});
