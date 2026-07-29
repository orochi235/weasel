import { describe, it, expect } from 'vitest';
import { insertAction } from './insert';

import type { InvocationCtx, BindingOpts } from '../invoker';
import type { NodeId } from 'core/scene/types';
import type { InsertDep, SnapDep } from '../depSchema';

// ---------------------------------------------------------------------------
// Stub insert dep
// ---------------------------------------------------------------------------

function makeInsertDep(): InsertDep & {
  calls: Array<{ bounds: unknown; kind: string; extras: unknown }>;
} {
  const calls: Array<{ bounds: unknown; kind: string; extras: unknown }> = [];
  return {
    calls,
    commit(bounds, extras) {
      calls.push({ bounds: { ...bounds }, kind: extras.kind, extras });
      return 'new-node-id' as NodeId;
    },
  };
}

function makeCtx(overrides: {
  world?: { x: number; y: number };
  dep?: InsertDep;
  snap?: SnapDep;
  modifiers?: Partial<InvocationCtx['modifiers']>;
} = {}): InvocationCtx {
  return {
    world: overrides.world ?? { x: 5, y: 10 },
    screen: { x: 5, y: 10 },
    modifiers: {
      alt: false, ctrl: false, meta: false, shift: false,
      ...(overrides.modifiers ?? {}),
    },
    deps: {
      insert: overrides.dep ?? makeInsertDep(),
      ...(overrides.snap ? { snap: overrides.snap } : {}),
    },
  };
}

/** Snaps every coord to a `size` grid. */
function gridSnap(size: number): SnapDep {
  return {
    point: (p) => ({
      x: Math.round(p.x / size) * size,
      y: Math.round(p.y / size) * size,
    }),
  };
}

function getOngoingInvoker(action: typeof insertAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('insertAction descriptor', () => {
  it('declares id, label, drag defaultBinding, and ongoing timing', () => {
    expect(insertAction.id).toBe('insert');
    expect(insertAction.label).toBe('Insert');
    expect(insertAction.defaultBinding).toEqual({ kind: 'drag' });
    expect(insertAction.invoker?.timing).toBe('ongoing');
  });

  it('requires insert dep', () => {
    expect(insertAction.requires).toContain('insert');
  });

  it('enabled returns true (insert is always available)', () => {
    expect(insertAction.enabled!()).toBe(true);
  });

  it('start returns empty handle when dep is absent', () => {
    const invoker = getOngoingInvoker(insertAction);
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: {},
    };
    const handle = invoker.start(ctx, undefined);
    expect(handle).toEqual({});
  });

  it('start returns a handle with onMove and onEnd when dep is present', () => {
    const invoker = getOngoingInvoker(insertAction);
    const handle = invoker.start(makeCtx(), undefined);
    expect(typeof handle.onMove).toBe('function');
    expect(typeof handle.onEnd).toBe('function');
  });

  it('onMove does not call dep.commit', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 50, y: 50 } });
    expect(dep.calls).toHaveLength(0);
  });

  it('onEnd("commit") calls dep.commit with correct bounds', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 5, y: 10 }, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 55, y: 60 } });
    handle.onEnd!({ ...ctx, world: { x: 55, y: 60 } }, 'commit');

    expect(dep.calls).toHaveLength(1);
    expect(dep.calls[0].bounds).toEqual({ x: 5, y: 10, width: 50, height: 50 });
  });

  it('onEnd("commit") passes kind from opts.params', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
    const opts: BindingOpts = { params: { kind: 'ellipse' } };
    const handle = invoker.start(ctx, opts);
    handle.onMove!({ ...ctx, world: { x: 100, y: 100 } });
    handle.onEnd!({ ...ctx, world: { x: 100, y: 100 } }, 'commit');

    expect(dep.calls[0].kind).toBe('ellipse');
  });

  it('onEnd("commit") defaults kind to "rect" when opts.params absent', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 80, y: 80 } });
    handle.onEnd!({ ...ctx, world: { x: 80, y: 80 } }, 'commit');

    expect(dep.calls[0].kind).toBe('rect');
  });

  it('onEnd("commit") is a no-op for zero-size drag (sub-threshold)', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 10, y: 10 }, dep });
    const handle = invoker.start(ctx, undefined);
    // No onMove → start === current → zero-size.
    handle.onEnd!({ ...ctx }, 'commit');
    expect(dep.calls).toHaveLength(0);
  });

  it('onEnd("cancel") does not call dep.commit', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 100, y: 100 } });
    handle.onEnd!({ ...ctx, world: { x: 100, y: 100 } }, 'cancel');
    expect(dep.calls).toHaveLength(0);
  });

  it('bounds are correctly oriented when drag goes in negative direction', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 100, y: 100 }, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 10, y: 20 } });
    handle.onEnd!({ ...ctx, world: { x: 10, y: 20 } }, 'commit');

    expect(dep.calls[0].bounds).toEqual({ x: 10, y: 20, width: 90, height: 80 });
  });

  // -------------------------------------------------------------------------
  // per-kind extras
  // -------------------------------------------------------------------------

  it('line kind: extras.a/b are the live drag endpoints (not AABB diagonal)', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    // Drag from (10, 50) to (100, 10) — slope upward / negative dy. The AABB
    // diagonal would go from (10, 10) to (100, 50), so a line-from-AABB would
    // slope downward. Asserting a/b match the actual gesture proves the fix.
    const ctx = makeCtx({ world: { x: 10, y: 50 }, dep });
    const opts: BindingOpts = { params: { kind: 'line' } };
    const handle = invoker.start(ctx, opts);
    handle.onMove!({ ...ctx, world: { x: 100, y: 10 } });
    handle.onEnd!({ ...ctx, world: { x: 100, y: 10 } }, 'commit');

    expect(dep.calls[0].kind).toBe('line');
    expect(dep.calls[0].extras).toMatchObject({
      a: { x: 10, y: 50 },
      b: { x: 100, y: 10 },
    });
  });

  it('polygon kind: thunked params are resolved at commit time (mid-gesture changes flow through)', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
    let sides = 5;
    const opts: BindingOpts = { params: () => ({ kind: 'polygon', sides, rotation: 0.25 }) };
    const handle = invoker.start(ctx, opts);
    handle.onMove!({ ...ctx, world: { x: 100, y: 100 } });
    // Simulate ArrowUp mid-drag: the ref the thunk closes over mutates.
    sides = 8;
    handle.onEnd!({ ...ctx, world: { x: 100, y: 100 } }, 'commit');

    expect(dep.calls[0].extras).toMatchObject({
      kind: 'polygon', sides: 8, rotation: 0.25,
    });
  });

  it('star kind: extras carry points + innerRadiusRatio + rotation', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
    const opts: BindingOpts = {
      params: { kind: 'star', points: 7, innerRadiusRatio: 0.4, rotation: 0 },
    };
    const handle = invoker.start(ctx, opts);
    handle.onMove!({ ...ctx, world: { x: 100, y: 100 } });
    handle.onEnd!({ ...ctx, world: { x: 100, y: 100 } }, 'commit');

    expect(dep.calls[0].extras).toMatchObject({
      kind: 'star', points: 7, innerRadiusRatio: 0.4,
    });
  });

  it('pencil kind: extras.samples come from the dispatcher drag.points trail', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const trail = [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 25, y: 15 }, { x: 40, y: 30 }];
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { insert: dep },
      drag: { start: { x: 0, y: 0 }, current: { x: 40, y: 30 }, delta: { x: 40, y: 30 }, points: trail },
    };
    const opts: BindingOpts = { params: { kind: 'pencil' } };
    const handle = invoker.start(ctx, opts);
    handle.onMove!({ ...ctx, world: { x: 40, y: 30 } });
    handle.onEnd!({ ...ctx, world: { x: 40, y: 30 } }, 'commit');

    expect(dep.calls[0].extras).toMatchObject({ kind: 'pencil' });
    expect((dep.calls[0].extras as { samples: unknown[] }).samples).toEqual(trail);
  });

  // -------------------------------------------------------------------------
  // overlay() — live insert-drag preview
  // -------------------------------------------------------------------------

  describe('overlay()', () => {
    it('returns null when the dep is absent (empty handle)', () => {
      const invoker = getOngoingInvoker(insertAction);
      const ctx: InvocationCtx = {
        world: { x: 0, y: 0 },
        screen: { x: 0, y: 0 },
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
        deps: {},
      };
      const handle = invoker.start(ctx, undefined);
      // No overlay method on empty handle.
      expect(handle.overlay).toBeUndefined();
    });

    it('returns an insertPreview with the current AABB after onMove', () => {
      const invoker = getOngoingInvoker(insertAction);
      const dep = makeInsertDep();
      const ctx = makeCtx({ world: { x: 5, y: 10 }, dep });
      const handle = invoker.start(ctx, undefined);
      handle.onMove!({ ...ctx, world: { x: 55, y: 60 } });
      const ov = handle.overlay!();
      expect(ov).toMatchObject({
        kind: 'insertPreview',
        shape: 'rect',
        bounds: { x: 5, y: 10, width: 50, height: 50 },
      });
    });

    it('reports the right shape for each kit kind', () => {
      const invoker = getOngoingInvoker(insertAction);
      const cases: Array<[string, Record<string, unknown>?]> = [
        ['rect'],
        ['ellipse'],
        ['line'],
        ['polygon', { sides: 6, rotation: 0 }],
        ['star', { points: 5, innerRadiusRatio: 0.5, rotation: 0 }],
      ];
      for (const [kind, extraParams] of cases) {
        const dep = makeInsertDep();
        const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
        const handle = invoker.start(ctx, { params: { kind, ...(extraParams ?? {}) } });
        handle.onMove!({ ...ctx, world: { x: 20, y: 30 } });
        const ov = handle.overlay!();
        expect(ov?.kind).toBe('insertPreview');
        if (ov?.kind === 'insertPreview') expect(ov.shape).toBe(kind);
      }
    });

    it('line: extras carry the live drag endpoints', () => {
      const invoker = getOngoingInvoker(insertAction);
      const dep = makeInsertDep();
      const ctx = makeCtx({ world: { x: 10, y: 50 }, dep });
      const handle = invoker.start(ctx, { params: { kind: 'line' } });
      handle.onMove!({ ...ctx, world: { x: 100, y: 10 } });
      const ov = handle.overlay!();
      if (ov?.kind !== 'insertPreview') throw new Error('expected insertPreview');
      expect(ov.extras).toMatchObject({ kind: 'line', a: { x: 10, y: 50 }, b: { x: 100, y: 10 } });
    });

    it('pencil: extras.samples reflect the growing drag trail', () => {
      const invoker = getOngoingInvoker(insertAction);
      const dep = makeInsertDep();
      const trail: { x: number; y: number }[] = [{ x: 0, y: 0 }];
      const ctx: InvocationCtx = {
        world: { x: 0, y: 0 },
        screen: { x: 0, y: 0 },
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
        deps: { insert: dep },
        drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 }, points: trail },
      };
      const handle = invoker.start(ctx, { params: { kind: 'pencil' } });
      // Grow the trail in-place — the dispatcher mutates the array reference.
      trail.push({ x: 10, y: 5 });
      trail.push({ x: 25, y: 15 });
      handle.onMove!({ ...ctx, world: { x: 25, y: 15 } });
      const ov = handle.overlay!();
      if (ov?.kind !== 'insertPreview') throw new Error('expected insertPreview');
      expect(ov.shape).toBe('pencil');
      expect((ov.extras as { samples: unknown[] }).samples).toEqual(trail);
    });

    it('polygon: thunked params resolve at overlay() call time (live preview reflects mid-gesture ticks)', () => {
      const invoker = getOngoingInvoker(insertAction);
      const dep = makeInsertDep();
      const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
      let sides = 5;
      const handle = invoker.start(ctx, {
        params: () => ({ kind: 'polygon', sides, rotation: 0 }),
      });
      handle.onMove!({ ...ctx, world: { x: 100, y: 100 } });
      let ov = handle.overlay!();
      if (ov?.kind !== 'insertPreview') throw new Error('expected insertPreview');
      expect((ov.extras as { sides: number }).sides).toBe(5);
      sides = 9;
      ov = handle.overlay!();
      if (ov?.kind !== 'insertPreview') throw new Error('expected insertPreview');
      expect((ov.extras as { sides: number }).sides).toBe(9);
    });

    it('returns null for unknown (consumer-defined) kinds — no kit-side preview', () => {
      const invoker = getOngoingInvoker(insertAction);
      const dep = makeInsertDep();
      const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
      const handle = invoker.start(ctx, { params: { kind: 'my-custom-widget' } });
      handle.onMove!({ ...ctx, world: { x: 30, y: 30 } });
      expect(handle.overlay!()).toBeNull();
    });

    it('returns null after onEnd (gesture closed)', () => {
      const invoker = getOngoingInvoker(insertAction);
      const dep = makeInsertDep();
      const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
      const handle = invoker.start(ctx, undefined);
      handle.onMove!({ ...ctx, world: { x: 30, y: 30 } });
      expect(handle.overlay!()).not.toBeNull();
      handle.onEnd!({ ...ctx, world: { x: 30, y: 30 } }, 'commit');
      expect(handle.overlay!()).toBeNull();
    });
  });

  it('pencil kind: commits even when start ≈ end (closed loop / sub-threshold AABB)', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    // User drew a tiny loop and ended near where they started — the AABB
    // would be sub-threshold (0×0) but the pencil trail is real.
    const trail = [{ x: 0, y: 0 }, { x: 5, y: 8 }, { x: -3, y: 6 }, { x: 0, y: 0 }];
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 },
      screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { insert: dep },
      drag: { start: { x: 0, y: 0 }, current: { x: 0, y: 0 }, delta: { x: 0, y: 0 }, points: trail },
    };
    const opts: BindingOpts = { params: { kind: 'pencil' } };
    const handle = invoker.start(ctx, opts);
    // No onMove — start ≈ end.
    handle.onEnd!(ctx, 'commit');

    expect(dep.calls).toHaveLength(1);
    expect(dep.calls[0].extras).toMatchObject({ kind: 'pencil' });
  });
});

describe('insertAction — snap dep', () => {
  it('snaps both the drag origin and the current point', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 3, y: 4 }, dep, snap: gridSnap(10) });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 47, y: 52 } });
    handle.onEnd!({ ...ctx, world: { x: 47, y: 52 } }, 'commit');

    // origin 3,4 → 0,0 · current 47,52 → 50,50
    expect(dep.calls[0].bounds).toEqual({ x: 0, y: 0, width: 50, height: 50 });
  });

  it('is identity when the snap dep is absent', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 3, y: 4 }, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 47, y: 52 } });
    handle.onEnd!({ ...ctx, world: { x: 47, y: 52 } }, 'commit');

    expect(dep.calls[0].bounds).toEqual({ x: 3, y: 4, width: 44, height: 48 });
  });

  it('the live preview reports the same snapped bounds the commit uses', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 3, y: 4 }, dep, snap: gridSnap(10) });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 47, y: 52 } });
    const preview = handle.overlay!();
    handle.onEnd!({ ...ctx, world: { x: 47, y: 52 } }, 'commit');

    expect(preview).toMatchObject({ kind: 'insertPreview' });
    expect((preview as { bounds: unknown }).bounds).toEqual(dep.calls[0].bounds);
  });

  it('does not snap freehand pencil samples', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const trail = [{ x: 1, y: 1 }, { x: 4, y: 7 }, { x: 9, y: 2 }];
    const ctx: InvocationCtx = {
      ...makeCtx({ world: { x: 1, y: 1 }, dep, snap: gridSnap(10) }),
      drag: { start: { x: 1, y: 1 }, current: { x: 9, y: 2 }, delta: { x: 8, y: 1 }, points: trail },
    };
    const handle = invoker.start(ctx, { params: { kind: 'pencil' } });
    handle.onEnd!(ctx, 'commit');

    expect(dep.calls[0].extras).toMatchObject({ kind: 'pencil', samples: trail });
  });
});

describe('insertAction — line modifiers', () => {
  it('shift constrains the endpoint to a 15° increment', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
    const handle = invoker.start(ctx, { params: { kind: 'line' } });
    // 100,10 is ~5.7° off horizontal — shift rounds it down to 0°, keeping
    // the drag length (hypot ≈ 100.5).
    handle.onMove!({ ...ctx, world: { x: 100, y: 10 }, modifiers: { ...ctx.modifiers, shift: true } });
    handle.onEnd!({ ...ctx, world: { x: 100, y: 10 } }, 'commit');

    const extras = dep.calls[0].extras as { b: { x: number; y: number } };
    expect(extras.b.y).toBeCloseTo(0, 6);
    expect(extras.b.x).toBeCloseTo(Math.hypot(100, 10), 6);
  });

  it('shift is not applied to non-line kinds', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
    const handle = invoker.start(ctx, { params: { kind: 'rect' } });
    handle.onMove!({ ...ctx, world: { x: 100, y: 10 }, modifiers: { ...ctx.modifiers, shift: true } });
    handle.onEnd!({ ...ctx, world: { x: 100, y: 10 } }, 'commit');

    expect(dep.calls[0].bounds).toEqual({ x: 0, y: 0, width: 100, height: 10 });
  });

  it('alt mirrors the start around the pointer (half-line drag)', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 50, y: 50 }, dep });
    const handle = invoker.start(ctx, { params: { kind: 'line' } });
    handle.onMove!({ ...ctx, world: { x: 80, y: 70 }, modifiers: { ...ctx.modifiers, alt: true } });
    handle.onEnd!({ ...ctx, world: { x: 80, y: 70 } }, 'commit');

    // start mirrors to 50-(80-50), 50-(70-50) = 20,30; end stays 80,70.
    expect(dep.calls[0].extras).toMatchObject({
      kind: 'line',
      a: { x: 20, y: 30 },
      b: { x: 80, y: 70 },
    });
  });

  it('shift constrains before snap, so the angle survives grid alignment', () => {
    const invoker = getOngoingInvoker(insertAction);
    const dep = makeInsertDep();
    const ctx = makeCtx({ world: { x: 0, y: 0 }, dep, snap: gridSnap(10) });
    const handle = invoker.start(ctx, { params: { kind: 'line' } });
    handle.onMove!({ ...ctx, world: { x: 100, y: 10 }, modifiers: { ...ctx.modifiers, shift: true } });
    handle.onEnd!({ ...ctx, world: { x: 100, y: 10 } }, 'commit');

    // Constrained to 0° → (100.5, 0), then snapped to the 10-grid → (100, 0).
    // Snapping first would have given (100, 10) — a 5.7° line.
    expect(dep.calls[0].extras).toMatchObject({
      kind: 'line',
      a: { x: 0, y: 0 },
      b: { x: 100, y: 0 },
    });
  });
});

// ---------------------------------------------------------------------------
// Text: drop into the caret after committing the box
// ---------------------------------------------------------------------------

function makeTextEditDep() {
  const calls: Array<{ id: string; opts?: { caret?: number | 'all' } }> = [];
  return { calls, startEdit(id: string, opts?: { caret?: number | 'all' }) { calls.push({ id, opts }); } };
}

describe('insertAction — text', () => {
  /** Run a full drag. The end context deliberately carries **no deps**: the
   *  dispatcher builds the deps bag once, on `start`, and passes `deps: {}`
   *  on every later pump event. A test that reuses the start context would
   *  pass against an implementation that reads `endCtx.deps` — which is
   *  always empty in the real app. */
  function drag(kind: string, deps: Record<string, unknown>, dep = makeInsertDep()) {
    const ctx = makeCtx({ dep });
    Object.assign(ctx.deps as Record<string, unknown>, deps);
    const invoker = getOngoingInvoker(insertAction);
    const handle = invoker.start(ctx, { params: { kind } } as BindingOpts);
    const end: InvocationCtx = { ...ctx, world: { x: 105, y: 60 }, deps: {} };
    handle.onMove?.(end);
    handle.onEnd?.(end, 'commit');
    return dep;
  }

  it('enters edit on the node it just inserted', () => {
    // A text box you can't type into is not a text box. The tool's own
    // click-to-edit binding needs the node selected first, which an
    // invisible empty box makes impossible to do by hand.
    const textEdit = makeTextEditDep();
    drag('text', { textEdit });
    expect(textEdit.calls).toEqual([{ id: 'new-node-id', opts: { caret: 0 } }]);
  });

  it('does not enter edit for other kinds', () => {
    const textEdit = makeTextEditDep();
    drag('rect', { textEdit });
    expect(textEdit.calls).toEqual([]);
  });

  it('commits the box even with no textEdit dep registered', () => {
    expect(drag('text', {}).calls).toHaveLength(1);
  });
});
