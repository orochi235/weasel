import { describe, expect, it, vi } from 'vitest';
import { selectFromLasso } from './selectFromLasso';
import type {
  GestureContext,
  LassoSelectPose,
} from '../../types';
import type { LassoSelectAdapter, LassoHitMode } from '../../../../core/adapters/types';

function ctx(opts: {
  vertices: { x: number; y: number }[];
  shiftHeld?: boolean;
  selection?: string[];
  hitTestLasso?: (poly: ReadonlyArray<{ x: number; y: number }>, mode: LassoHitMode) => string[];
}): GestureContext<LassoSelectPose> {
  const adapter: LassoSelectAdapter = {
    getSelection: () => opts.selection ?? [],
    setSelection: () => {},
    applyOps: () => {},
    hitTestLasso: opts.hitTestLasso ?? (() => []),
  };
  const startPose: LassoSelectPose = { worldX: 0, worldY: 0, shiftHeld: opts.shiftHeld ?? false };
  return {
    draggedIds: ['gesture'],
    origin: new Map([['gesture', startPose]]),
    current: new Map([['gesture', { ...startPose, worldX: 1, worldY: 1 }]]),
    snap: null,
    modifiers: { alt: false, shift: !!opts.shiftHeld, meta: false, ctrl: false },
    pointer: { worldX: 1, worldY: 1, clientX: 0, clientY: 0 },
    adapter: adapter as unknown as GestureContext<LassoSelectPose>['adapter'],
    scratch: { 'lassoSelect.vertices': opts.vertices },
  };
}

describe('selectFromLasso', () => {
  it('returns null when adapter has no hitTestLasso', () => {
    const beh = selectFromLasso();
    const c = ctx({ vertices: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] });
    (c.adapter as unknown as LassoSelectAdapter).hitTestLasso = undefined;
    expect(beh.onEnd!(c)).toBeNull();
  });

  it('replaces selection with hits in non-shift mode', () => {
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      selection: ['old'],
      hitTestLasso: () => ['a', 'b'],
    });
    const ops = beh.onEnd!(c)!;
    expect(ops).toHaveLength(1);
    let setTo: string[] = [];
    ops[0].apply({ setSelection: (ids: string[]) => { setTo = ids; } });
    expect(setTo).toEqual(['a', 'b']);
  });

  it('extends selection with hits when shift held', () => {
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      selection: ['old'],
      shiftHeld: true,
      hitTestLasso: () => ['a', 'old'],
    });
    const ops = beh.onEnd!(c)!;
    let setTo: string[] = [];
    ops[0].apply({ setSelection: (ids: string[]) => { setTo = ids; } });
    expect(setTo).toEqual(['old', 'a']);
  });

  it('forwards mode option to hitTestLasso', () => {
    const fn = vi.fn(() => []);
    const beh = selectFromLasso({ mode: 'enclosed' });
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      hitTestLasso: fn,
    });
    beh.onEnd!(c);
    expect(fn).toHaveBeenCalledWith(expect.anything(), 'enclosed');
  });

  it('default mode is intersect', () => {
    const fn = vi.fn(() => []);
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
      hitTestLasso: fn,
    });
    beh.onEnd!(c);
    expect(fn).toHaveBeenCalledWith(expect.anything(), 'intersect');
  });

  it('tiny lasso (< 3 vertices) clears selection', () => {
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      selection: ['old'],
    });
    const ops = beh.onEnd!(c)!;
    let setTo: string[] = ['sentinel'];
    ops[0].apply({ setSelection: (ids: string[]) => { setTo = ids; } });
    expect(setTo).toEqual([]);
  });

  it('tiny lasso with shift held preserves selection', () => {
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }],
      selection: ['old'],
      shiftHeld: true,
    });
    const ops = beh.onEnd!(c)!;
    let setTo: string[] = [];
    ops[0].apply({ setSelection: (ids: string[]) => { setTo = ids; } });
    expect(setTo).toEqual(['old']);
  });

  it('vanishingly small AABB (< 4 world-units²) treated as click', () => {
    const beh = selectFromLasso();
    const c = ctx({
      vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],   // area 0.5
      selection: ['old'],
    });
    const ops = beh.onEnd!(c)!;
    let setTo: string[] = ['sentinel'];
    ops[0].apply({ setSelection: (ids: string[]) => { setTo = ids; } });
    expect(setTo).toEqual([]);
  });

  it('defaultTransient: true', () => {
    expect(selectFromLasso().defaultTransient).toBe(true);
  });
});
