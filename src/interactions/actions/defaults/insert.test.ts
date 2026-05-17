import { describe, it, expect } from 'vitest';
import { insertAction } from './insert';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx, BindingOpts } from '../invoker';
import type { NodeId } from 'core/scene/types';
import type { InsertDep } from '../depSchema';

// ---------------------------------------------------------------------------
// Stub insert dep
// ---------------------------------------------------------------------------

function makeInsertDep(): InsertDep & { calls: Array<{ bounds: unknown; kind: string }> } {
  const calls: Array<{ bounds: unknown; kind: string }> = [];
  return {
    calls,
    commit(bounds, kind) {
      calls.push({ bounds: { ...bounds }, kind });
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
  it('declares id, label, drag gestureBinding, and ongoing timing', () => {
    expect(insertAction.id).toBe('insert');
    expect(insertAction.label).toBe('Insert');
    expect(insertAction.gestureBinding).toEqual({ kind: 'drag' });
    expect(insertAction.invoker?.timing).toBe('ongoing');
  });

  it('requires insert dep', () => {
    expect(insertAction.requires).toContain('insert');
  });

  it('enabled returns SelectionRequired (static placeholder)', () => {
    expect(insertAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
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
});
