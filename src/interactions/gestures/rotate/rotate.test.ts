import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRotate } from './rotate';
import { pointInRotatedRect, rotationHandle, hitRotationHandle } from './index';
import type { RotateAdapter } from 'core/adapters/types';
import type { Op } from 'core/ops/types';
import type { RotatedPose } from '../types';

function makeAdapter(initial?: Array<[string, RotatedPose]>) {
  const state = new Map<string, RotatedPose>(
    initial ?? [['a', { x: 0, y: 0, width: 100, height: 50, rotation: 0 }]],
  );
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: RotateAdapter<{ id: string }, RotatedPose> = {
    getObject: (id) => (state.has(id) ? { id } : undefined),
    getPose: (id) => ({ ...state.get(id)! }),
    setPose: (id, pose) => state.set(id, { ...pose }),
    applyBatch: (ops, label) => {
      batches.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, batches, state };
}

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };

describe('useRotate — start / cancel', () => {
  it('start sets isActive and overlay; cancel clears them with no batch', () => {
    const { adapter, batches } = makeAdapter();
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter, {}),
    );
    expect(result.current.isActive()).toBe(false);
    act(() => {
      // Pivot is (50, 25). Start with pointer at the right side.
      result.current.start({ id: 'a', worldX: 150, worldY: 25 });
    });
    expect(result.current.isActive()).toBe(true);
    expect(result.current.overlay!.id).toBe('a');
    expect(result.current.overlay!.targetPose).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      rotation: 0,
    });

    act(() => {
      result.current.cancel();
    });
    expect(result.current.isActive()).toBe(false);
    expect(result.current.overlay).toBeNull();
    expect(batches).toEqual([]);
  });
});

describe('useRotate — move', () => {
  it('quarter-turn: pointer moves 90° around pivot → targetPose.rotation === π/2', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter, {}),
    );
    act(() => {
      // Pivot (50, 25). Pointer to the east (angle 0).
      result.current.start({ id: 'a', worldX: 150, worldY: 25 });
    });
    act(() => {
      // Pointer to the south (angle +π/2 in screen y-down coords).
      result.current.move({ worldX: 50, worldY: 125, modifiers: NO_MOD });
    });
    expect(result.current.overlay!.targetPose.rotation).toBeCloseTo(Math.PI / 2, 5);
  });
});

describe('useRotate — end', () => {
  it('emits one TransformOp using targetPose rotation', () => {
    const { adapter, batches, state } = makeAdapter();
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter, {}),
    );
    act(() => {
      result.current.start({ id: 'a', worldX: 150, worldY: 25 });
    });
    act(() => {
      result.current.move({ worldX: 50, worldY: 125, modifiers: NO_MOD });
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Rotate');
    expect(batches[0].ops).toHaveLength(1);
    expect(state.get('a')!.rotation).toBeCloseTo(Math.PI / 2, 5);
  });

  it('end with no rotation change emits no batch', () => {
    const { adapter, batches } = makeAdapter();
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter, {}),
    );
    act(() => {
      result.current.start({ id: 'a', worldX: 150, worldY: 25 });
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toEqual([]);
  });
});

describe('pointInRotatedRect', () => {
  const pose: RotatedPose = { x: 0, y: 0, width: 100, height: 50, rotation: 0 };

  it('rotation=0 matches a plain AABB test', () => {
    expect(pointInRotatedRect(pose, 50, 25)).toBe(true);
    expect(pointInRotatedRect(pose, -1, 25)).toBe(false);
    expect(pointInRotatedRect(pose, 50, 60)).toBe(false);
  });

  it('rotated 90°: a point that was outside the AABB is now inside', () => {
    const rotated: RotatedPose = { ...pose, rotation: Math.PI / 2 };
    // Pivot is (50, 25). A point at (50, 70) sits outside the unrotated rect
    // (y=70 > 50) but inside the 90°-rotated one (rotated rect spans
    // x∈[25,75], y∈[-25,75]).
    expect(pointInRotatedRect(rotated, 50, 70)).toBe(true);
    // A point that was inside the unrotated rect (90, 25) sits outside once
    // rotated (rotated x range is [25, 75]).
    expect(pointInRotatedRect(rotated, 90, 25)).toBe(false);
  });
});

describe('rotationHandle / hitRotationHandle', () => {
  it('rotation=0: handle is directly above the top-center', () => {
    const h = rotationHandle({ x: 0, y: 0, width: 100, height: 50, rotation: 0 }, 24);
    expect(h.cx).toBeCloseTo(50, 5);
    expect(h.cy).toBeCloseTo(-24, 5);
  });

  it('rotated 90°: handle moves to the right of the rotated bbox center', () => {
    // Pivot (50, 25). Unrotated handle position (50, -24) → rotate +π/2 →
    // (50 + (-24-25)*0 - ((-24)-25)*1, 25 + (50-50)*1 + (-24-25)*0) wait let me
    // just compute: rotating (50, -24) around (50, 25) by π/2:
    // dx=0, dy=-49; new dx = -dy = 49; new dy = dx = 0; → (99, 25).
    const h = rotationHandle({ x: 0, y: 0, width: 100, height: 50, rotation: Math.PI / 2 }, 24);
    expect(h.cx).toBeCloseTo(99, 5);
    expect(h.cy).toBeCloseTo(25, 5);
  });

  it('hit-test passes within radius, fails outside', () => {
    const h = rotationHandle({ x: 0, y: 0, width: 100, height: 50, rotation: 0 }, 24);
    expect(hitRotationHandle(h, 50, -24, 8)).toBe(true);
    expect(hitRotationHandle(h, 50 + 7, -24 - 7, 8)).toBe(true);
    expect(hitRotationHandle(h, 50 + 9, -24, 8)).toBe(false);
  });
});

import { createDebugSink } from '../../../debug/createDebugSink';

describe('useRotate — debug recording', () => {
  it('records a rotation handle position on gesture start', () => {
    const sink = createDebugSink({ handles: true });
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter, { debug: sink }),
    );
    act(() => {
      result.current.start({ id: 'a', worldX: 0, worldY: 0 });
    });
    const rh = sink.snapshot().handles.filter((h) => h.kind === 'rotation');
    expect(rh.length).toBe(1);
  });

  it('records a rotation hitbox on gesture start', () => {
    const sink = createDebugSink({ hitboxes: true });
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter, { debug: sink }),
    );
    act(() => {
      result.current.start({ id: 'a', worldX: 0, worldY: 0 });
    });
    const hits = sink.snapshot().hitboxes.filter((h) => h.kind === 'rotation');
    expect(hits.length).toBe(1);
  });
});
