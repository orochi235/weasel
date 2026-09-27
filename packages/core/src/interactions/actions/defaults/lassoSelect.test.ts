import { describe, it, expect } from 'vitest';
import { lassoSelectAction } from './lassoSelect';
import type { InvocationCtx } from '@weasel-js/routing';
import type { LassoSelectDep } from '../depSchema';
import { getScratch } from '@weasel-js/routing';
import type { LassoSelectBehavior, LassoSelectProposed } from '../../gestures/types';
import {
  LASSO_VERTICES,
  selectFromLasso,
} from '../lasso-select/behaviors/selectFromLasso';
import { createSetSelectionOp } from 'core/ops/select';
import type { NodeId } from 'core/scene/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLassoSelectDep(
  hits: string[] = [],
  initial: string[] = [],
): LassoSelectDep & { calls: { hitTestArea: unknown[]; hitTestLasso: unknown[]; setSelection: unknown[][] } } {
  let selection = initial.slice();
  const calls = {
    hitTestArea: [] as unknown[],
    hitTestLasso: [] as unknown[],
    setSelection: [] as unknown[][],
  };
  return {
    calls,
    hitTestArea(bounds) {
      calls.hitTestArea.push(bounds);
      return hits;
    },
    hitTestLasso(polygon, mode) {
      calls.hitTestLasso.push({ polygon, mode });
      return hits;
    },
    getSelection() {
      return selection;
    },
    setSelection(ids) {
      calls.setSelection.push(ids.slice());
      selection = ids;
    },
  };
}

function makeCtx(dep?: LassoSelectDep, world = { x: 10, y: 20 }): InvocationCtx {
  return {
    world,
    screen: world,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: dep ? { lassoSelect: dep } : {},
  };
}

function getOngoingInvoker(action: typeof lassoSelectAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('lassoSelectAction descriptor', () => {
  it('declares id, label, drag defaultBinding, and ongoing timing', () => {
    expect(lassoSelectAction.id).toBe('lassoSelect');
    expect(lassoSelectAction.label).toBe('Lasso Select');
    expect(lassoSelectAction.defaultBinding).toEqual({ kind: 'drag', mods: { shift: 'optional' } });
    expect(lassoSelectAction.invoker?.timing).toBe('ongoing');
  });

  it('requires lassoSelect dep', () => {
    expect(lassoSelectAction.requires).toContain('lassoSelect');
  });

  it('enabled returns true (always enabled)', () => {
    expect(lassoSelectAction.enabled!()).toBe(true);
  });

  it('start returns empty handle when deps are absent', () => {
    const invoker = getOngoingInvoker(lassoSelectAction);
    const handle = invoker.start(makeCtx(undefined), undefined);
    expect(handle).toEqual({});
  });

  it('overlay() exposes lasso shape with vertices + current; updates on move; clears on end', () => {
    // Dispatcher-side chrome surface for the lasso polyline.
    const invoker = getOngoingInvoker(lassoSelectAction);
    const dep = makeLassoSelectDep();
    const startCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: true },
      deps: { lassoSelect: dep },
    };
    const handle = invoker.start(startCtx, undefined);

    // Initial: single vertex at the start point; current matches.
    const initial = handle.overlay!();
    expect(initial?.kind).toBe('lasso');
    expect(initial && 'vertices' in initial ? Array.from(initial.vertices) : null).toEqual([{ x: 0, y: 0 }]);
    expect(initial && 'current' in initial ? initial.current : null).toEqual({ x: 0, y: 0 });
    expect(initial && 'shiftHeld' in initial ? initial.shiftHeld : null).toBe(true);

    const moveCtx = (wx: number, wy: number): InvocationCtx => ({
      world: { x: wx, y: wy },
      screen: { x: wx, y: wy },
      modifiers: { alt: false, ctrl: false, meta: false, shift: true },
      deps: {},
    });

    // Move past the vertex-spacing threshold — vertex appends, current tracks.
    handle.onMove!(moveCtx(10, 0));
    handle.onMove!(moveCtx(10, 10));
    const mid = handle.overlay!();
    expect(mid?.kind).toBe('lasso');
    const midVerts = mid && 'vertices' in mid ? Array.from(mid.vertices) : [];
    expect(midVerts).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(mid && 'current' in mid ? mid.current : null).toEqual({ x: 10, y: 10 });

    // Commit → overlay clears.
    handle.onEnd!(moveCtx(10, 10), 'commit');
    expect(handle.overlay!()).toBeNull();

    // Cancel path on a fresh handle.
    const handle2 = invoker.start(startCtx, undefined);
    expect(handle2.overlay!()).not.toBeNull();
    handle2.onEnd!(moveCtx(0, 0), 'cancel');
    expect(handle2.overlay!()).toBeNull();
  });

  it('start returns handle with onMove and onEnd when dep is present', () => {
    const invoker = getOngoingInvoker(lassoSelectAction);
    const dep = makeLassoSelectDep();
    const handle = invoker.start(makeCtx(dep), undefined);
    expect(typeof handle.onMove).toBe('function');
    expect(typeof handle.onEnd).toBe('function');
  });

  it('onEnd(commit) calls hitTestLasso with accumulated vertices and sets selection', () => {
    const invoker = getOngoingInvoker(lassoSelectAction);
    const dep = makeLassoSelectDep(['nodeA', 'nodeB']);
    const handle = invoker.start(makeCtx(dep, { x: 0, y: 0 }), undefined);

    // Accumulate enough vertices (need >=3 for a polygon)
    const moveCtx = (wx: number, wy: number): InvocationCtx => ({
      world: { x: wx, y: wy },
      screen: { x: wx, y: wy },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    });
    handle.onMove!(moveCtx(10, 0));
    handle.onMove!(moveCtx(10, 10));
    handle.onMove!(moveCtx(0, 10));

    const endCtx: InvocationCtx = {
      world: { x: 0, y: 10 },
      screen: { x: 0, y: 10 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    handle.onEnd!(endCtx, 'commit');

    expect(dep.calls.hitTestLasso.length).toBe(1);
    expect(dep.calls.setSelection).toEqual([['nodeA', 'nodeB']]);
  });

  it("hit-tests in the binding's params.mode, 'intersect' when none is given", () => {
    const invoker = getOngoingInvoker(lassoSelectAction);
    const run = (opts: Parameters<typeof invoker.start>[1]) => {
      const dep = makeLassoSelectDep();
      const handle = invoker.start(makeCtx(dep, { x: 0, y: 0 }), opts);
      for (const [x, y] of [[10, 0], [10, 10], [0, 10]]) {
        handle.onMove!({ ...makeCtx(), world: { x, y }, screen: { x, y } });
      }
      handle.onEnd!(makeCtx(), 'commit');
      return (dep.calls.hitTestLasso[0] as { mode: string }).mode;
    };
    expect(run(undefined)).toBe('intersect');
    expect(run({ params: { mode: 'enclosed' } })).toBe('enclosed');
    expect(run({ params: () => ({ mode: 'centers' }) })).toBe('centers');
  });

  it("spaces vertices by the binding's params.minVertexSpacing, 2 world-px when none is given", () => {
    const invoker = getOngoingInvoker(lassoSelectAction);
    const run = (opts: Parameters<typeof invoker.start>[1]) => {
      const handle = invoker.start(makeCtx(makeLassoSelectDep(), { x: 0, y: 0 }), opts);
      for (const x of [1, 2, 3, 4, 5, 6]) {
        handle.onMove!({ ...makeCtx(), world: { x, y: 0 }, screen: { x, y: 0 } });
      }
      const o = handle.overlay!();
      return o && 'vertices' in o ? o.vertices.map((v) => v.x) : null;
    };
    expect(run(undefined)).toEqual([0, 2, 4, 6]);
    expect(run({ params: { minVertexSpacing: 0 } })).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(run({ params: () => ({ minVertexSpacing: 5 }) })).toEqual([0, 5]);
  });

  it('onEnd(commit) falls back to hitTestArea AABB when hitTestLasso is absent', () => {
    const invoker = getOngoingInvoker(lassoSelectAction);
    const dep = makeLassoSelectDep(['nodeX']);
    // Remove hitTestLasso to test fallback
    delete (dep as { hitTestLasso?: unknown }).hitTestLasso;
    const handle = invoker.start(makeCtx(dep, { x: 0, y: 0 }), undefined);

    const moveCtx = (wx: number, wy: number): InvocationCtx => ({
      world: { x: wx, y: wy },
      screen: { x: wx, y: wy },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    });
    handle.onMove!(moveCtx(10, 0));
    handle.onMove!(moveCtx(10, 10));
    handle.onMove!(moveCtx(0, 10));

    const endCtx: InvocationCtx = {
      world: { x: 0, y: 10 },
      screen: { x: 0, y: 10 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    handle.onEnd!(endCtx, 'commit');

    expect(dep.calls.hitTestArea.length).toBe(1);
    expect(dep.calls.setSelection).toEqual([['nodeX']]);
  });

  it('onEnd(cancel) does not call setSelection', () => {
    const invoker = getOngoingInvoker(lassoSelectAction);
    const dep = makeLassoSelectDep(['nodeA']);
    const handle = invoker.start(makeCtx(dep, { x: 0, y: 0 }), undefined);

    const moveCtx = (wx: number, wy: number): InvocationCtx => ({
      world: { x: wx, y: wy },
      screen: { x: wx, y: wy },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    });
    handle.onMove!(moveCtx(10, 0));
    handle.onMove!(moveCtx(10, 10));

    const endCtx: InvocationCtx = {
      world: { x: 0, y: 10 },
      screen: { x: 0, y: 10 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    handle.onEnd!(endCtx, 'cancel');

    expect(dep.calls.setSelection).toEqual([]);
  });

  it('shift+commit extends selection (deduplicates)', () => {
    const invoker = getOngoingInvoker(lassoSelectAction);
    const dep = makeLassoSelectDep(['nodeB'], ['nodeA']);
    const startCtx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: true },
      deps: { lassoSelect: dep },
    };
    const handle = invoker.start(startCtx, undefined);

    const moveCtx = (wx: number, wy: number): InvocationCtx => ({
      world: { x: wx, y: wy },
      screen: { x: wx, y: wy },
      modifiers: { alt: false, ctrl: false, meta: false, shift: true },
      deps: {},
    });
    handle.onMove!(moveCtx(10, 0));
    handle.onMove!(moveCtx(10, 10));
    handle.onMove!(moveCtx(0, 10));

    const endCtx: InvocationCtx = {
      world: { x: 0, y: 10 },
      screen: { x: 0, y: 10 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: true },
      deps: {},
    };
    handle.onEnd!(endCtx, 'commit');

    // Extended: nodeA (existing) + nodeB (hit) deduplicated
    expect(dep.calls.setSelection).toEqual([['nodeA', 'nodeB']]);
  });
});

describe('lassoSelectAction behaviors', () => {
  const SQUARE: Array<[number, number]> = [[10, 0], [10, 10], [0, 10]];

  function drive(
    dep: LassoSelectDep,
    behaviors: LassoSelectBehavior[],
    params?: Record<string, unknown>,
  ): void {
    const invoker = getOngoingInvoker(lassoSelectAction);
    const handle = invoker.start(makeCtx(dep, { x: 0, y: 0 }), {
      behaviors,
      ...(params ? { params } : {}),
    });
    for (const [x, y] of SQUARE) {
      handle.onMove!({ ...makeCtx(), world: { x, y }, screen: { x, y } });
    }
    handle.onEnd!(makeCtx(), 'commit');
  }

  it('runs each hook with the gesture pose, the vertices and the proposed lasso', () => {
    const dep = makeLassoSelectDep();
    const seen: string[] = [];
    let lastProposed: LassoSelectProposed | undefined;
    drive(dep, [{
      onStart: (ctx) => { seen.push(`start ${JSON.stringify(ctx.origin.get('gesture'))}`); },
      onMove: (_ctx, proposed) => { lastProposed = proposed; },
      onEnd: (ctx) => {
        seen.push(`end ${getScratch(ctx.scratch, LASSO_VERTICES)?.length}`);
        return undefined;
      },
    }]);
    expect(seen).toEqual([
      'start {"worldX":0,"worldY":0,"shiftHeld":false}',
      'end 4',
    ]);
    expect(lastProposed?.vertices).toHaveLength(4);
    expect(lastProposed?.shiftHeld).toBe(false);
  });

  it('commits the ops a behavior returns in place of the default selection', () => {
    const dep = makeLassoSelectDep(['hit']);
    drive(dep, [{ onEnd: () => [createSetSelectionOp({ from: [], to: ['chosen' as NodeId] })] }]);
    expect(dep.calls.setSelection).toEqual([['chosen']]);
    expect(dep.calls.hitTestLasso).toEqual([]);
  });

  it('commits nothing when a behavior aborts with null', () => {
    const dep = makeLassoSelectDep(['hit']);
    drive(dep, [{ onEnd: () => null }]);
    expect(dep.calls.setSelection).toEqual([]);
  });

  it('falls through to the default selection when every behavior defers', () => {
    const dep = makeLassoSelectDep(['hit']);
    drive(dep, [{ onEnd: () => undefined }]);
    expect(dep.calls.setSelection).toEqual([['hit']]);
  });

  it("selectFromLasso reaches the dep's hit-test in its own mode", () => {
    const dep = makeLassoSelectDep(['hit']);
    drive(dep, [selectFromLasso({ mode: 'enclosed' })], { mode: 'centers' });
    expect(dep.calls.hitTestLasso).toHaveLength(1);
    expect((dep.calls.hitTestLasso[0] as { mode: string }).mode).toBe('enclosed');
    expect(dep.calls.setSelection).toEqual([['hit']]);
  });
});
