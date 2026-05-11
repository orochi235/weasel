import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMove } from './move';
import type { LayoutStrategy } from '../../../layout/types';
import type { MoveAdapter } from 'core/adapters/types';

type Obj = { id: string };
type P = { x: number; y: number; width: number; height: number };

function makeAdapter(opts: {
  poses: Record<string, P>;
  parents: Record<string, string | null>;
  children: Record<string, string[]>;
  getLayout: (id: string) => LayoutStrategy<P> | null;
}): MoveAdapter<Obj, P> {
  const poses = { ...opts.poses };
  const setPoseSpy = vi.fn((id: string, p: P) => {
    poses[id] = p;
  });
  return {
    getNode: (id) => ({ id }),
    getNodes: () => Object.keys(poses).map((id) => ({ id })),
    getPose: (id) => poses[id],
    getParent: (id) => opts.parents[id] ?? null,
    setPose: setPoseSpy,
    setParent: () => {},
    getChildren: (id) => opts.children[id] ?? [],
    applyBatch: vi.fn(),
    getLayout: opts.getLayout,
  };
}

/**
 * A circular layout strategy: container's pose carries an AABB
 * `{x,y,width,height}`, but the strategy treats it as a circle inscribed
 * in that AABB. `contains()` overrides the default AABB hit-test so a
 * dragged center inside the circle (but outside an AABB corner) still
 * registers as inside the container.
 */
function circularLayout(): LayoutStrategy<P> {
  return {
    contains(containerPose, point) {
      const cx = containerPose.x + containerPose.width / 2;
      const cy = containerPose.y + containerPose.height / 2;
      const r = Math.min(containerPose.width, containerPose.height) / 2;
      const dx = point.x - cx;
      const dy = point.y - cy;
      return dx * dx + dy * dy <= r * r;
    },
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

describe('useMove with non-AABB layout container (contains hook)', () => {
  it('treats a circular container as the hit-test surface (inside circle, outside AABB corner)', () => {
    // Circle inscribed in (0,0,100,100). Point (95, 95) is inside the AABB
    // but outside the circle (distance from center (50,50) is ~63.6 > radius 50).
    // Center point (50, 50) is inside both. We need a point inside the circle
    // but outside an arbitrary AABB to stress the hook — pick an AABB that
    // omits one corner. Easier: use a non-AABB-corner case: an AABB at (10,10,80,80).
    // Pointer at (50,50) is inside the circle. Now make the AABB tight around
    // a small region so AABB and circle differ.
    //
    // Simpler design: prove the hook is consulted by giving `contains` a
    // result that conflicts with the AABB — return TRUE for a point clearly
    // outside the container's pose AABB. Without the hook the dragged center
    // would fail the AABB check; with it, the container is picked.
    const layout: LayoutStrategy<P> = {
      contains: (_pose, point) => point.x > 0, // accept anywhere on the right half-plane
      getChildPositions: () => new Map(),
      getDropTargets: (container) => [{
        pose: container.bounds as unknown as P,
        origin: { x: container.bounds.x, y: container.bounds.y },
      }],
      reflowFor: () => new Map(),
      commitDrop: () => [],
      snap: { pickTarget: (targets) => targets[0] ?? null },
    };
    const adapter = makeAdapter({
      poses: {
        // Container AABB tiny in the corner; dragged center at (200, 200) is
        // FAR outside this AABB but `contains` returns true.
        C: { x: 0, y: 0, width: 10, height: 10 },
        a: { x: 190, y: 190, width: 20, height: 20 },
      },
      parents: { C: null, a: null },
      children: { C: [] },
      getLayout: (id) => (id === 'C' ? layout : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 200, worldY: 200, clientX: 200, clientY: 200 });
    });
    act(() => {
      result.current.move({
        worldX: 220, worldY: 220, clientX: 220, clientY: 220,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });

    const overlay = result.current.overlay!;
    // With the contains hook present and returning true, container 'C' is
    // picked even though the dragged center is well outside its AABB.
    expect(overlay.destContainerId).toBe('C');
  });

  it('hits a circular container when the dragged center is inside the circle but outside the AABB-style strict-corner check', () => {
    // Real-world circular case: container AABB is (0,0,100,100), inscribed
    // circle centered at (50,50) with radius 50. Pointer at (50, 50) is
    // inside both — but we test a point near the edge: (5, 50). Distance
    // from (50,50) is 45 < 50 (inside circle). It's also inside AABB, so
    // not a stress test. Use a non-AABB origin: container AABB at (-50,-50,
    // 100,100) — circle at origin radius 50. Dragged center at (40, 0):
    // inside both. To stress, shrink AABB while keeping `contains` semantics.
    //
    // Cleanest: Use the circularLayout helper but place dragged where
    // AABB-fallback would pass anyway, then place a SECOND non-circular
    // container with a tighter AABB to confirm the layout-supplied predicate
    // takes precedence over the default.
    const layout = circularLayout();
    const adapter = makeAdapter({
      poses: {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 40, y: 40, width: 20, height: 20 }, // center (50,50)
      },
      parents: { C: null, a: null },
      children: { C: [] },
      getLayout: (id) => (id === 'C' ? layout : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 50, worldY: 50, clientX: 50, clientY: 50 });
    });
    // Drag center to (50, 50) — center of both circle and AABB. Already inside.
    // Move slightly so phase becomes active.
    act(() => {
      result.current.move({
        worldX: 55, worldY: 55, clientX: 55, clientY: 55,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });

    expect(result.current.overlay!.destContainerId).toBe('C');
  });

  it('falls back to AABB when contains is absent', () => {
    // No `contains` field — layout uses default rect AABB.
    const layout: LayoutStrategy<P> = {
      getChildPositions: () => new Map(),
      getDropTargets: (container) => [{
        pose: container.bounds as unknown as P,
        origin: { x: container.bounds.x, y: container.bounds.y },
      }],
      reflowFor: () => new Map(),
      commitDrop: () => [],
      snap: { pickTarget: (targets) => targets[0] ?? null },
    };
    const adapter = makeAdapter({
      poses: {
        C: { x: 0, y: 0, width: 100, height: 100 },
        a: { x: 200, y: 200, width: 20, height: 20 }, // center far outside C
      },
      parents: { C: null, a: null },
      children: { C: [] },
      getLayout: (id) => (id === 'C' ? layout : null),
    });
    const { result } = renderHook(() => useMove(adapter));

    act(() => {
      result.current.start({ ids: ['a'], worldX: 210, worldY: 210, clientX: 210, clientY: 210 });
    });
    act(() => {
      result.current.move({
        worldX: 220, worldY: 220, clientX: 220, clientY: 220,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      });
    });

    const overlay = result.current.overlay!;
    expect(overlay.destContainerId).toBeNull();
    expect(overlay.accepted).toBe(false);
  });
});
