import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRotate } from './rotate';
import { pointInRotatedRect, rotationHandle, hitRotationHandle } from './index';
import type { RotateAdapter } from 'core/adapters/types';
import type { Op } from 'core/ops/types';
import type { RotatedPose } from '../../gestures/types';

function makeAdapter(initial?: Array<[string, RotatedPose]>) {
  const state = new Map<string, RotatedPose>(
    initial ?? [['a', { x: 0, y: 0, width: 100, height: 50, rotation: 0 }]],
  );
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: RotateAdapter<{ id: string }, RotatedPose> = {
    getNode: (id) => (state.has(id) ? { id } : undefined),
    getPose: (id) => ({ ...state.get(id)! }),
    setPose: (id, pose) => state.set(id, { ...pose }),
    applyOps: (ops, label) => {
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

describe('useRotate — pivot: "each"', () => {
  it('rotates each item around its own center; x/y unchanged', () => {
    const { adapter, state } = makeAdapter([
      ['a', { x: 0, y: 0, width: 10, height: 10, rotation: 0 }],
      ['b', { x: 100, y: 0, width: 20, height: 20, rotation: 0 }],
    ]);
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter, { pivot: 'each' }),
    );
    // Union AABB: x [0,120], y [0,20]; union center (60, 10).
    // Start with pointer at (60, -90) — angle from union center = -π/2.
    act(() => result.current.start({ ids: ['a', 'b'], worldX: 60, worldY: -90 }));
    // Move to (160, 10) — angle from union center = 0, delta = +π/2.
    act(() => result.current.move({ worldX: 160, worldY: 10, modifiers: NO_MOD }));
    act(() => result.current.end());
    expect(state.get('a')!.rotation).toBeCloseTo(Math.PI / 2, 5);
    expect(state.get('b')!.rotation).toBeCloseTo(Math.PI / 2, 5);
    // x/y unchanged in 'each' mode.
    expect(state.get('a')!.x).toBe(0);
    expect(state.get('a')!.y).toBe(0);
    expect(state.get('b')!.x).toBe(100);
    expect(state.get('b')!.y).toBe(0);
  });
});

describe('useRotate — pivot: "union"', () => {
  it('orbits each item around the union center', () => {
    const { adapter, state } = makeAdapter([
      ['a', { x: 0, y: 0, width: 10, height: 10, rotation: 0 }],     // center (5, 5)
      ['b', { x: 100, y: 0, width: 10, height: 10, rotation: 0 }],   // center (105, 5)
    ]);
    // Union AABB: x [0,110], y [0,10]; union center (55, 5).
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter, { pivot: 'union' }),
    );
    // Start with pointer at (55, -50) — angle = -π/2 from union center.
    act(() => result.current.start({ ids: ['a', 'b'], worldX: 55, worldY: -50 }));
    // Move to (105, 5) — angle = 0 from union center, so delta = +π/2.
    act(() => result.current.move({ worldX: 105, worldY: 5, modifiers: NO_MOD }));
    act(() => result.current.end());

    // a's center orbits from (5, 5): offset (-50, 0) rotated +π/2 → (0, -50).
    // New center (55, -45). a's new x = 55 - 5 = 50; new y = -45 - 5 = -50.
    expect(state.get('a')!.x).toBeCloseTo(50, 4);
    expect(state.get('a')!.y).toBeCloseTo(-50, 4);
    expect(state.get('a')!.rotation).toBeCloseTo(Math.PI / 2, 5);

    // b's center orbits from (105, 5): offset (50, 0) rotated +π/2 → (0, 50).
    // New center (55, 55). b's new x = 55 - 5 = 50; new y = 55 - 5 = 50.
    expect(state.get('b')!.x).toBeCloseTo(50, 4);
    expect(state.get('b')!.y).toBeCloseTo(50, 4);
    expect(state.get('b')!.rotation).toBeCloseTo(Math.PI / 2, 5);
  });

  it('single-id selection produces the same result in either pivot mode', () => {
    const init: [string, RotatedPose] = [
      'a',
      { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
    ];
    const eachRig = makeAdapter([init]);
    const unionRig = makeAdapter([init]);
    const each = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(eachRig.adapter, { pivot: 'each' }),
    ).result;
    const uni = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(unionRig.adapter, { pivot: 'union' }),
    ).result;
    for (const r of [each, uni]) {
      act(() => r.current.start({ ids: ['a'], worldX: 5, worldY: -10 }));
      act(() => r.current.move({ worldX: 15, worldY: 5, modifiers: NO_MOD }));
      act(() => r.current.end());
    }
    expect(eachRig.state.get('a')).toEqual(unionRig.state.get('a'));
  });
});

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

describe('useRotate — Shift-snap', () => {
  it('snaps the proposed rotation to the nearest 15° when shift is held', () => {
    const { adapter, state } = makeAdapter([
      ['a', { x: 0, y: 0, width: 10, height: 10, rotation: 0 }],
    ]);
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter),
    );
    act(() => result.current.start({ ids: ['a'], worldX: 5, worldY: -10 }));
    // Pivot (5, 5). Raw delta of ~+47° (between 45° and 60°) snaps to 45°.
    const startAngle = Math.atan2(-10 - 5, 5 - 5); // -π/2
    const targetDelta = (47 * Math.PI) / 180;
    const targetAngle = startAngle + targetDelta;
    const worldX = 5 + 30 * Math.cos(targetAngle);
    const worldY = 5 + 30 * Math.sin(targetAngle);
    act(() =>
      result.current.move({
        worldX,
        worldY,
        modifiers: { alt: false, shift: true, meta: false, ctrl: false },
      }),
    );
    act(() => result.current.end());
    expect(state.get('a')!.rotation).toBeCloseTo((45 * Math.PI) / 180, 6);
  });

  it('does NOT snap when shift is not held', () => {
    const { adapter, state } = makeAdapter([
      ['a', { x: 0, y: 0, width: 10, height: 10, rotation: 0 }],
    ]);
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter),
    );
    act(() => result.current.start({ ids: ['a'], worldX: 5, worldY: -10 }));
    const startAngle = -Math.PI / 2;
    const targetDelta = (47 * Math.PI) / 180;
    const targetAngle = startAngle + targetDelta;
    const worldX = 5 + 30 * Math.cos(targetAngle);
    const worldY = 5 + 30 * Math.sin(targetAngle);
    act(() => result.current.move({ worldX, worldY, modifiers: NO_MOD }));
    act(() => result.current.end());
    expect(state.get('a')!.rotation).toBeCloseTo((47 * Math.PI) / 180, 3);
  });

  it('snaps small deltas to 0° (within ±7.5° of an increment)', () => {
    const { adapter, state } = makeAdapter([
      ['a', { x: 0, y: 0, width: 10, height: 10, rotation: 0 }],
    ]);
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter),
    );
    act(() => result.current.start({ ids: ['a'], worldX: 5, worldY: -10 }));
    const startAngle = -Math.PI / 2;
    const targetDelta = (7 * Math.PI) / 180;
    const targetAngle = startAngle + targetDelta;
    const worldX = 5 + 30 * Math.cos(targetAngle);
    const worldY = 5 + 30 * Math.sin(targetAngle);
    act(() =>
      result.current.move({
        worldX,
        worldY,
        modifiers: { alt: false, shift: true, meta: false, ctrl: false },
      }),
    );
    act(() => result.current.end());
    expect(state.get('a')!.rotation).toBeCloseTo(0, 6);
  });
});

describe('useRotate — origin rotation undefined defaults to 0', () => {
  it('item with no prior rotation field rotates without NaN', () => {
    // Consumer Pose with `rotation?: number` may surface undefined on
    // never-rotated items. Default-to-0 prevents NaN propagation through
    // the new rotation, which previously broke both rendering and
    // hit-test (NaN propagates through Math.cos / wrapWithRotation guards).
    const initial: RotatedPose = { x: 0, y: 0, width: 100, height: 50 } as RotatedPose;
    // Cast away the explicit rotation field so the test rig stores undefined.
    delete (initial as { rotation?: number }).rotation;
    const { adapter, state } = makeAdapter([['a', initial]]);
    const { result } = renderHook(() =>
      useRotate<{ id: string }, RotatedPose>(adapter),
    );
    // Start at angle 0 relative to AABB center (50, 25): worldX=150, worldY=25.
    act(() => result.current.start({ ids: ['a'], worldX: 150, worldY: 25 }));
    // Move to angle 90° → worldX=50, worldY=125.
    act(() =>
      result.current.move({ worldX: 50, worldY: 125, modifiers: NO_MOD }),
    );
    act(() => result.current.end());
    const r = state.get('a')!.rotation;
    expect(Number.isNaN(r)).toBe(false);
    expect(r).toBeCloseTo(Math.PI / 2, 6);
  });
});
