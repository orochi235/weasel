import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResize } from './resize';
import { pathPoseDescriptor } from 'features/paths/poseDescriptor';
import { polygonFromPoints, type PolygonPath, type Path } from 'features/paths';
import type { Op } from 'core/ops/types';
import type { ResizeAdapter } from 'core/adapters/types';

function makeAdapter(initial: Path) {
  const state = new Map<string, Path>([['a', initial]]);
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: ResizeAdapter<{ id: string }, Path> = {
    getObject: (id) => (state.has(id) ? { id } : undefined),
    getPose: (id) => state.get(id)!,
    setPose: (id, pose) => state.set(id, pose),
    applyBatch: (ops, label) => {
      batches.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, batches, state };
}

describe('useResize — non-rect TPose via pathPoseDescriptor', () => {
  it('drives a polygon pose: emitted op carries a remapped polygon scaled against drag bounds', () => {
    // Triangle with AABB (0,0,10,10).
    const tri = polygonFromPoints(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ],
    );
    const { adapter, batches } = makeAdapter(tri);

    const { result } = renderHook(() =>
      useResize<{ id: string }, Path>(adapter, {
        geometry: pathPoseDescriptor,
      }),
    );

    act(() => {
      // East anchor: width grows by dx.
      result.current.start('a', { x: 'min', y: 'free' }, 10, 0);
    });
    act(() => {
      // Drag east edge from x=10 to x=20 → bounds (0,0,20,10), scale x by 2.
      result.current.move(20, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.end();
    });

    expect(batches).toHaveLength(1);
    expect(batches[0].ops).toHaveLength(1);
    expect(batches[0].label).toBe('Resize');

    const after = adapter.getPose('a') as PolygonPath;
    expect(after.kind).toBe('polygon');
    // x scaled by 2, y unchanged.
    expect(after.coords[0]).toBeCloseTo(0, 5);
    expect(after.coords[1]).toBeCloseTo(0, 5);
    expect(after.coords[2]).toBeCloseTo(20, 5);
    expect(after.coords[3]).toBeCloseTo(0, 5);
    expect(after.coords[4]).toBeCloseTo(10, 5);
    expect(after.coords[5]).toBeCloseTo(10, 5);
  });

  it('overlay.currentPose remains a Path (lerped) and overlay.targetPose is the final remapped Path', () => {
    const tri = polygonFromPoints(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ],
    );
    const { adapter } = makeAdapter(tri);
    const { result } = renderHook(() =>
      useResize<{ id: string }, Path>(adapter, { geometry: pathPoseDescriptor }),
    );

    act(() => {
      result.current.start('a', { x: 'min', y: 'free' }, 10, 0);
    });
    act(() => {
      result.current.move(20, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });

    const ov = result.current.overlay!;
    const target = ov.targetPose as PolygonPath;
    expect(target.kind).toBe('polygon');
    // Final apex x stays at midline of new bounds.
    expect(target.coords[4]).toBeCloseTo(10, 5);
    expect(target.coords[2]).toBeCloseTo(20, 5);

    const cur = ov.currentPose as PolygonPath;
    expect(cur.kind).toBe('polygon');
    // Lerped 35% from origin (10) toward proposed (20) → 13.5.
    expect(cur.coords[2]).toBeCloseTo(13.5, 5);
  });
});
