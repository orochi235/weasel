import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResize } from './resize';
import { clampMinSize } from './behaviors/clampMinSize';
import { snapToGrid } from './behaviors/snapToGrid';
import type { ResizeBehavior, ResizePose } from '../types';
import type { Op } from 'core/ops/types';
import type { ResizeAdapter } from 'core/adapters/types';

interface P extends ResizePose {}

function makeAdapter(initial?: Array<[string, P]>) {
  const state = new Map<string, P>(
    initial ?? [['a', { x: 0, y: 0, width: 10, height: 10 }]],
  );
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: ResizeAdapter<{ id: string }, P> = {
    getNode: (id) => (state.has(id) ? { id } : undefined),
    getPose: (id) => ({ ...(state.get(id)!) }),
    setPose: (id, pose) => state.set(id, { ...pose }),
    applyBatch: (ops, label) => {
      batches.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, batches, state };
}

describe('useResize — start / cancel', () => {
  it('start sets isResizing and overlay; cancel clears them with no batch', () => {
    const { adapter, batches } = makeAdapter();
    const { result } = renderHook(() => useResize<{ id: string }, P>(adapter, {}));
    expect(result.current.isResizing).toBe(false);

    act(() => {
      result.current.start('a', { x: 'min', y: 'free' }, 0, 0);
    });
    expect(result.current.isResizing).toBe(true);
    expect(result.current.overlay).not.toBeNull();
    expect(result.current.overlay!.id).toBe('a');
    expect(result.current.overlay!.currentPose).toEqual({ x: 0, y: 0, width: 10, height: 10 });
    expect(result.current.overlay!.targetPose).toEqual({ x: 0, y: 0, width: 10, height: 10 });

    act(() => {
      result.current.cancel();
    });
    expect(result.current.isResizing).toBe(false);
    expect(result.current.overlay).toBeNull();
    expect(batches).toEqual([]);
  });
});

describe('useResize — move', () => {
  it('east anchor=min: width grows toward target; currentPose lerps 35%', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() => useResize<{ id: string }, P>(adapter, {}));
    act(() => {
      result.current.start('a', { x: 'min', y: 'free' }, 10, 0);
    });
    act(() => {
      result.current.move(14, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    const ov = result.current.overlay!;
    expect(ov.targetPose).toEqual({ x: 0, y: 0, width: 14, height: 10 });
    expect(ov.currentPose.width).toBeCloseTo(11.4, 5);
  });

  it('behaviors compose in order; clampMinSize integrates', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, {
        behaviors: [clampMinSize<P>({ minWidth: 1, minHeight: 1 })],
      }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'free' }, 10, 0);
    });
    act(() => {
      result.current.move(-2, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    expect(result.current.overlay!.targetPose.width).toBe(1);
  });

  it('snapToGrid integrates: targetPose snaps; sub-grid origin suspends snap', () => {
    const { adapter, state } = makeAdapter();
    state.set('a', { x: 0, y: 0, width: 0.5, height: 10 });
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, {
        behaviors: [snapToGrid<P>({ spacing: 1 })],
      }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'free' }, 0.5, 0);
    });
    act(() => {
      result.current.move(0.7, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    expect(result.current.overlay!.targetPose.width).toBeCloseTo(0.7, 5);
  });
});

describe('useResize — end', () => {
  it('emits one TransformOp using targetPose (not lerped currentPose)', () => {
    const { adapter, batches, state } = makeAdapter();
    const { result } = renderHook(() => useResize<{ id: string }, P>(adapter, {}));
    act(() => {
      result.current.start('a', { x: 'min', y: 'free' }, 10, 0);
    });
    act(() => {
      result.current.move(14, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Resize');
    expect(batches[0].ops).toHaveLength(1);
    expect(state.get('a')).toEqual({ x: 0, y: 0, width: 14, height: 10 });
  });

  it('end with no move emits no batch', () => {
    const { adapter, batches } = makeAdapter();
    const { result } = renderHook(() => useResize<{ id: string }, P>(adapter, {}));
    act(() => {
      result.current.start('a', { x: 'min', y: 'free' }, 10, 0);
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toEqual([]);
  });

  it('behavior onEnd returning Op[] overrides default', () => {
    const { adapter, batches } = makeAdapter();
    const customOp: Op = {
      apply() {},
      invert() { return customOp; },
      label: 'Custom',
    };
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, {
        behaviors: [{ onEnd: () => [customOp] }],
      }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'free' }, 10, 0);
    });
    act(() => {
      result.current.move(14, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].ops[0]).toBe(customOp);
  });

  it('behavior onEnd returning null aborts (no batch)', () => {
    const { adapter, batches } = makeAdapter();
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, {
        behaviors: [{ onEnd: () => null }],
      }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'free' }, 10, 0);
    });
    act(() => {
      result.current.move(14, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toEqual([]);
  });
});

describe('useResize — group (expandIds)', () => {
  const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };

  it('expandIds returning the same single id leaves single-leaf behavior unchanged', () => {
    const { adapter, batches, state } = makeAdapter();
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, {
        expandIds: (ids) => ids,
      }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'free' }, 10, 0);
    });
    act(() => {
      result.current.move(14, 0, NO_MOD);
    });
    expect(result.current.overlay!.id).toBe('a');
    expect(result.current.overlay!.targetPose).toEqual({ x: 0, y: 0, width: 14, height: 10 });
    act(() => {
      result.current.end();
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].ops).toHaveLength(1);
    expect(state.get('a')).toEqual({ x: 0, y: 0, width: 14, height: 10 });
  });

  it('SE-corner drag: both group leaves scale proportionally in width and height', () => {
    const { adapter, batches, state } = makeAdapter([
      ['a', { x: 0, y: 0, width: 10, height: 10 }],
      ['b', { x: 20, y: 20, width: 10, height: 10 }],
    ]);
    const expandIds = (ids: string[]) => (ids[0] === 'G' ? ['a', 'b'] : ids);
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { expandIds }),
    );
    act(() => {
      result.current.start('G', { x: 'min', y: 'min' }, 30, 30);
    });
    expect(result.current.overlay!.id).toBe('G');
    expect(result.current.overlay!.targetPose).toEqual({ x: 0, y: 0, width: 30, height: 30 });

    act(() => {
      result.current.move(60, 60, NO_MOD);
    });
    const ov = result.current.overlay!;
    expect(ov.targetPose).toEqual({ x: 0, y: 0, width: 60, height: 60 });
    expect(ov.leafPoses).toBeDefined();
    expect(ov.leafPoses!.get('a')).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    expect(ov.leafPoses!.get('b')).toEqual({ x: 40, y: 40, width: 20, height: 20 });

    act(() => {
      result.current.end();
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Resize');
    expect(batches[0].ops).toHaveLength(2);
    expect(state.get('a')).toEqual({ x: 0, y: 0, width: 20, height: 20 });
    expect(state.get('b')).toEqual({ x: 40, y: 40, width: 20, height: 20 });
  });

  it('NW-corner drag: rect closer to NW moves more in absolute terms', () => {
    const { adapter, batches, state } = makeAdapter([
      ['a', { x: 0, y: 0, width: 10, height: 10 }],
      ['b', { x: 20, y: 20, width: 10, height: 10 }],
    ]);
    const expandIds = (ids: string[]) => (ids[0] === 'G' ? ['a', 'b'] : ids);
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { expandIds }),
    );
    act(() => {
      result.current.start('G', { x: 'max', y: 'max' }, 0, 0);
    });
    act(() => {
      result.current.move(-30, -30, NO_MOD);
    });
    const ov = result.current.overlay!;
    expect(ov.targetPose).toEqual({ x: -30, y: -30, width: 60, height: 60 });
    expect(ov.leafPoses!.get('a')).toEqual({ x: -30, y: -30, width: 20, height: 20 });
    expect(ov.leafPoses!.get('b')).toEqual({ x: 10, y: 10, width: 20, height: 20 });

    act(() => {
      result.current.end();
    });
    expect(state.get('a')).toEqual({ x: -30, y: -30, width: 20, height: 20 });
    expect(state.get('b')).toEqual({ x: 10, y: 10, width: 20, height: 20 });
    expect(batches[0].ops).toHaveLength(2);
  });

  it('asymmetric group bounds preserve relative positions/sizes after scaling', () => {
    const { adapter, state } = makeAdapter([
      ['tall', { x: 0, y: 0, width: 5, height: 30 }],
      ['wide', { x: 10, y: 0, width: 30, height: 5 }],
    ]);
    const expandIds = (ids: string[]) => (ids[0] === 'G' ? ['tall', 'wide'] : ids);
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { expandIds }),
    );
    act(() => {
      result.current.start('G', { x: 'min', y: 'min' }, 40, 30);
    });
    act(() => {
      result.current.move(80, 60, NO_MOD);
    });
    const ov = result.current.overlay!;
    expect(ov.leafPoses!.get('tall')).toEqual({ x: 0, y: 0, width: 10, height: 60 });
    expect(ov.leafPoses!.get('wide')).toEqual({ x: 20, y: 0, width: 60, height: 10 });
    act(() => {
      result.current.end();
    });
    expect(state.get('tall')).toEqual({ x: 0, y: 0, width: 10, height: 60 });
    expect(state.get('wide')).toEqual({ x: 20, y: 0, width: 60, height: 10 });
  });

  it('behavior runs on group bounds — snap width to 100 snaps GROUP, not each child', () => {
    const { adapter, state } = makeAdapter([
      ['a', { x: 0, y: 0, width: 40, height: 40 }],
      ['b', { x: 50, y: 0, width: 40, height: 40 }],
    ]);
    const expandIds = (ids: string[]) => (ids[0] === 'G' ? ['a', 'b'] : ids);
    const snapBehavior: ResizeBehavior<P> = {
      onMove: (_ctx, { pose }) => ({ pose: { ...pose, width: 100 } }),
    };
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, {
        expandIds,
        behaviors: [snapBehavior],
      }),
    );
    act(() => {
      result.current.start('G', { x: 'min', y: 'free' }, 90, 0);
    });
    act(() => {
      result.current.move(95, 0, NO_MOD);
    });
    const ov = result.current.overlay!;
    expect(ov.targetPose.width).toBe(100);
    const a = ov.leafPoses!.get('a')!;
    const b = ov.leafPoses!.get('b')!;
    expect(a.width).toBeCloseTo(40 * (100 / 90), 5);
    expect(b.width).toBeCloseTo(40 * (100 / 90), 5);
    expect(a.width).not.toBe(100);
    act(() => {
      result.current.end();
    });
    expect(state.get('a')!.width).toBeCloseTo(40 * (100 / 90), 5);
    expect(state.get('b')!.width).toBeCloseTo(40 * (100 / 90), 5);
  });

  it('zero-area group axis (colinear leaves): zero axis scale is no-op (no NaN)', () => {
    const { adapter, state } = makeAdapter([
      ['a', { x: 0, y: 5, width: 10, height: 0 }],
      ['b', { x: 20, y: 5, width: 10, height: 0 }],
    ]);
    const expandIds = (ids: string[]) => (ids[0] === 'G' ? ['a', 'b'] : ids);
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { expandIds }),
    );
    act(() => {
      result.current.start('G', { x: 'min', y: 'min' }, 30, 5);
    });
    act(() => {
      result.current.move(60, 10, NO_MOD);
    });
    const ov = result.current.overlay!;
    const a = ov.leafPoses!.get('a')!;
    const b = ov.leafPoses!.get('b')!;
    expect(Number.isFinite(a.x)).toBe(true);
    expect(Number.isFinite(a.y)).toBe(true);
    expect(Number.isFinite(a.width)).toBe(true);
    expect(Number.isFinite(a.height)).toBe(true);
    expect(Number.isFinite(b.x)).toBe(true);
    expect(Number.isFinite(b.y)).toBe(true);
    expect(a.y).toBe(5);
    expect(a.height).toBe(0);
    expect(b.y).toBe(5);
    expect(b.height).toBe(0);
    expect(a.x).toBe(0);
    expect(a.width).toBe(20);
    expect(b.x).toBe(40);
    expect(b.width).toBe(20);
    act(() => {
      result.current.end();
    });
    expect(state.get('a')!.height).toBe(0);
  });

  it('end emits N transformOps in one batch with shared label', () => {
    const { adapter, batches } = makeAdapter([
      ['a', { x: 0, y: 0, width: 10, height: 10 }],
      ['b', { x: 20, y: 20, width: 10, height: 10 }],
      ['c', { x: 40, y: 40, width: 10, height: 10 }],
    ]);
    const expandIds = (ids: string[]) => (ids[0] === 'G' ? ['a', 'b', 'c'] : ids);
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, {
        expandIds,
        resizeLabel: 'Resize Group',
      }),
    );
    act(() => {
      result.current.start('G', { x: 'min', y: 'min' }, 50, 50);
    });
    act(() => {
      result.current.move(100, 100, NO_MOD);
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Resize Group');
    expect(batches[0].ops).toHaveLength(3);
  });

  it('cancel emits no ops in group path', () => {
    const { adapter, batches } = makeAdapter([
      ['a', { x: 0, y: 0, width: 10, height: 10 }],
      ['b', { x: 20, y: 20, width: 10, height: 10 }],
    ]);
    const expandIds = (ids: string[]) => (ids[0] === 'G' ? ['a', 'b'] : ids);
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { expandIds }),
    );
    act(() => {
      result.current.start('G', { x: 'min', y: 'min' }, 30, 30);
    });
    act(() => {
      result.current.move(60, 60, NO_MOD);
    });
    act(() => {
      result.current.cancel();
    });
    expect(batches).toEqual([]);
    expect(result.current.overlay).toBeNull();
  });

  it('group end with no move emits no batch', () => {
    const { adapter, batches } = makeAdapter([
      ['a', { x: 0, y: 0, width: 10, height: 10 }],
      ['b', { x: 20, y: 20, width: 10, height: 10 }],
    ]);
    const expandIds = (ids: string[]) => (ids[0] === 'G' ? ['a', 'b'] : ids);
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { expandIds }),
    );
    act(() => {
      result.current.start('G', { x: 'min', y: 'min' }, 30, 30);
    });
    act(() => {
      result.current.end();
    });
    expect(batches).toEqual([]);
  });
});


import { createDebugSink } from '../../../debug/createDebugSink';

describe('useResize — debug recording', () => {
  it('records 4 corner-handle positions on gesture start', () => {
    const sink = createDebugSink({ handles: true });
    const { adapter } = makeAdapter([['a', { x: 0, y: 0, width: 40, height: 30 }]]);
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { debug: sink }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'min' }, 0, 0);
    });
    const handles = sink.snapshot().handles.filter((h) => h.kind === 'corner');
    expect(handles.length).toBe(4);
  });

  it('records 4 corner-handle hitboxes on gesture start', () => {
    const sink = createDebugSink({ hitboxes: true });
    const { adapter } = makeAdapter([['a', { x: 0, y: 0, width: 40, height: 30 }]]);
    const { result } = renderHook(() =>
      useResize<{ id: string }, P>(adapter, { debug: sink }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'min' }, 0, 0);
    });
    const hits = sink.snapshot().hitboxes.filter((h) => h.kind === 'handle');
    expect(hits.length).toBe(4);
  });

  it('records nothing when no debug sink is supplied', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() => useResize<{ id: string }, P>(adapter, {}));
    expect(() => {
      act(() => {
        result.current.start('a', { x: 'min', y: 'min' }, 0, 0);
      });
    }).not.toThrow();
  });
});

import { ROTATED_POSE_DESCRIPTOR } from './geometry';
import type { RotatedPose } from '../types';
import { rotatePoint } from '../rotate/geometry';
import { lockAspectWithModifier } from './behaviors/lockAspect';

interface RP extends RotatedPose {}

function makeRotatedAdapter(initial: Array<[string, RP]>) {
  const state = new Map<string, RP>(initial.map(([k, v]) => [k, { ...v }]));
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: ResizeAdapter<{ id: string }, RP> = {
    getNode: (id) => (state.has(id) ? { id } : undefined),
    getPose: (id) => ({ ...(state.get(id)!) }),
    setPose: (id, pose) => state.set(id, { ...pose }),
    applyBatch: (ops, label) => {
      batches.push({ ops, label });
      for (const op of ops) op.apply(adapter);
    },
  };
  return { adapter, batches, state };
}

function fixedCornerWorld(pose: RP, anchor: { x: 'min' | 'max'; y: 'min' | 'max' }): { x: number; y: number } {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  // anchor names the fixed edge: 'min' → left/top edge fixed; 'max' → right/bottom edge fixed.
  const localX = anchor.x === 'max' ? pose.x + pose.width : pose.x;
  const localY = anchor.y === 'max' ? pose.y + pose.height : pose.y;
  return rotatePoint(localX, localY, cx, cy, pose.rotation);
}

describe('useResize — rotated leaf: anchor invariance', () => {
  const angles = [0, Math.PI / 6, Math.PI / 4, Math.PI / 2, -Math.PI / 4, Math.PI];
  const anchors: Array<{ x: 'min' | 'max'; y: 'min' | 'max' }> = [
    { x: 'min', y: 'min' }, // drag BR; fix TL
    { x: 'min', y: 'max' }, // drag TR; fix BL
    { x: 'max', y: 'min' }, // drag BL; fix TR
    { x: 'max', y: 'max' }, // drag TL; fix BR
  ];

  for (const angle of angles) {
    for (const anchor of anchors) {
      it(`pins the fixed corner in world space (θ=${angle.toFixed(3)}, anchor=${anchor.x}/${anchor.y})`, () => {
        const origin: RP = { x: 0, y: 0, width: 100, height: 60, rotation: angle };
        const { adapter, state } = makeRotatedAdapter([['a', origin]]);
        const { result } = renderHook(() =>
          useResize<{ id: string }, RP>(adapter, { geometry: ROTATED_POSE_DESCRIPTOR }),
        );

        const fixedAtStart = fixedCornerWorld(origin, anchor);

        act(() => {
          result.current.start('a', anchor, 50, 30);
        });
        act(() => {
          result.current.move(80, 50, { alt: false, shift: false, meta: false, ctrl: false });
        });
        act(() => {
          result.current.end();
        });

        const final = state.get('a')!;
        const fixedAtEnd = fixedCornerWorld(final, anchor);
        expect(fixedAtEnd.x).toBeCloseTo(fixedAtStart.x, 5);
        expect(fixedAtEnd.y).toBeCloseTo(fixedAtStart.y, 5);
      });
    }
  }
});

describe('useResize — rotated leaf: drag projection', () => {
  it('θ=π/2: a drag of (10, 0) world maps to a drag of (0, -10) local (CCW 90°)', () => {
    // Origin pose at (0,0,100,60), rotated 90° CCW about its AABB center.
    // A pointer drag of +10 in world-x corresponds, in the leaf's local frame,
    // to -10 in y (because local axes are rotated 90° from world axes).
    // Anchor min/min (drag bottom-right corner): local-y delta -10 means
    // the bottom edge moves UP by 10, shrinking height to 50.
    const origin: RP = { x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 2 };
    const { adapter } = makeRotatedAdapter([['a', origin]]);
    const { result } = renderHook(() =>
      useResize<{ id: string }, RP>(adapter, { geometry: ROTATED_POSE_DESCRIPTOR }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'min' }, 0, 0);
    });
    act(() => {
      result.current.move(10, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    const ov = result.current.overlay!;
    // Local-frame width should be unchanged (drag had no x-component in local frame).
    expect(ov.targetPose.width).toBeCloseTo(100, 5);
    // Local-frame height should be reduced by 10.
    expect(ov.targetPose.height).toBeCloseTo(50, 5);
  });
});

describe('useResize — rotated leaf: behaviors operate on local-frame bounds', () => {
  it('lockAspectWithModifier preserves local-frame width/height ratio under rotation', () => {
    const origin: RP = { x: 0, y: 0, width: 100, height: 50, rotation: Math.PI / 4 };
    const ratio = 100 / 50; // 2:1 in local frame.
    const { adapter } = makeRotatedAdapter([['a', origin]]);
    const { result } = renderHook(() =>
      useResize<{ id: string }, RP>(adapter, {
        geometry: ROTATED_POSE_DESCRIPTOR,
        behaviors: [lockAspectWithModifier<RP>({ key: 'shift' })],
      }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'min' }, 0, 0);
    });
    // Drag with shift; modifier locks aspect ratio.
    act(() => {
      result.current.move(40, 40, { alt: false, shift: true, meta: false, ctrl: false });
    });
    const ov = result.current.overlay!;
    expect(ov.targetPose.width / ov.targetPose.height).toBeCloseTo(ratio, 4);
  });
});

describe('useResize — rotated leaf: flipped pose preserved', () => {
  it('drag past fixed corner produces negative width; rotation preserved', () => {
    const origin: RP = { x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 6 };
    const { adapter, state } = makeRotatedAdapter([['a', origin]]);
    const { result } = renderHook(() =>
      useResize<{ id: string }, RP>(adapter, { geometry: ROTATED_POSE_DESCRIPTOR }),
    );
    act(() => {
      result.current.start('a', { x: 'min', y: 'min' }, 0, 0);
    });
    // Big negative-x drag (in world): projected into local frame, width should
    // go negative.
    act(() => {
      result.current.move(-300, 0, { alt: false, shift: false, meta: false, ctrl: false });
    });
    act(() => {
      result.current.end();
    });
    const final = state.get('a')!;
    expect(final.width).toBeLessThan(0);
    expect(final.rotation).toBeCloseTo(Math.PI / 6, 5);
  });
});

describe('useResize — group resize with rotated leaves emits a dev warning', () => {
  it('warns once at start when any leaf has rotation != 0', () => {
    const origin: RP = { x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 6 };
    const { adapter } = makeRotatedAdapter([['a', origin], ['b', { ...origin, x: 200 }]]);
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args) => { warnings.push(args.join(' ')); };
    try {
      const { result } = renderHook(() =>
        useResize<{ id: string }, RP>(adapter, {
          geometry: ROTATED_POSE_DESCRIPTOR,
          expandIds: () => ['a', 'b'],
        }),
      );
      act(() => {
        result.current.start('group', { x: 'min', y: 'min' }, 0, 0);
      });
      // Move a few times — warning should fire only once at start.
      act(() => {
        result.current.move(10, 10, { alt: false, shift: false, meta: false, ctrl: false });
      });
      act(() => {
        result.current.move(20, 20, { alt: false, shift: false, meta: false, ctrl: false });
      });
    } finally {
      console.warn = origWarn;
    }
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toMatch(/group resize with rotated leaves is not supported/);
  });
});
