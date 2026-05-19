import { describe, it, expect } from 'vitest';
import { insertAction } from './insert';

import type { InvocationCtx, BindingOpts } from '../invoker';
import type { NodeId } from 'core/scene/types';
import type { InsertDep } from '../depSchema';

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
} = {}): InvocationCtx {
  return {
    world: overrides.world ?? { x: 5, y: 10 },
    screen: { x: 5, y: 10 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: {
      insert: overrides.dep ?? makeInsertDep(),
    },
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
  // Phase 14c.3: per-kind extras
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
  // overlay() — live insert-drag preview (Phase 14e Task 2 follow-up)
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
