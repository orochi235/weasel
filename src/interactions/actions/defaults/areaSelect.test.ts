import { describe, it, expect } from 'vitest';
import { areaSelectAction } from './areaSelect';
import { ActionDisabledReason } from '../registry';
import type { InvocationCtx } from '../invoker';
import type { NodeId } from 'core/scene/types';
import type { AreaSelectDep } from '../depSchema';

// ---------------------------------------------------------------------------
// Stub areaSelect dep
// ---------------------------------------------------------------------------

function makeAreaSelectDep(
  hits: string[] = [],
  initial: string[] = [],
): AreaSelectDep & { calls: { hitTestArea: unknown[]; setSelection: unknown[][] } } {
  let selection = initial.slice() as NodeId[];
  const calls = { hitTestArea: [] as unknown[], setSelection: [] as unknown[][] };
  return {
    calls,
    hitTestArea(bounds) {
      calls.hitTestArea.push(bounds);
      return hits as NodeId[];
    },
    getSelection() {
      return selection;
    },
    setSelection(ids: NodeId[]) {
      calls.setSelection.push(ids.slice());
      selection = ids;
    },
  };
}

function makeCtx(
  overrides: {
    world?: { x: number; y: number };
    shift?: boolean;
    dep?: AreaSelectDep;
  } = {},
): InvocationCtx {
  return {
    world: overrides.world ?? { x: 10, y: 20 },
    screen: { x: 10, y: 20 },
    modifiers: { alt: false, ctrl: false, meta: false, shift: overrides.shift ?? false },
    deps: {
      areaSelect: overrides.dep ?? makeAreaSelectDep(),
    },
  };
}

function getOngoingInvoker(action: typeof areaSelectAction) {
  if (!action.invoker || action.invoker.timing !== 'ongoing') {
    throw new Error('Expected ongoing invoker');
  }
  return action.invoker;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('areaSelectAction descriptor', () => {
  it('declares id, label, drag gestureBinding, and ongoing timing', () => {
    expect(areaSelectAction.id).toBe('areaSelect');
    expect(areaSelectAction.label).toBe('Area Select');
    expect(areaSelectAction.gestureBinding).toEqual({ kind: 'drag' });
    expect(areaSelectAction.invoker?.timing).toBe('ongoing');
  });

  it('requires areaSelect dep', () => {
    expect(areaSelectAction.requires).toContain('areaSelect');
  });

  it('enabled returns SelectionRequired (static placeholder)', () => {
    expect(areaSelectAction.enabled!()).toBe(ActionDisabledReason.SelectionRequired);
  });

  it('start returns empty handle when dep is absent', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
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
    const invoker = getOngoingInvoker(areaSelectAction);
    const handle = invoker.start(makeCtx(), undefined);
    expect(typeof handle.onMove).toBe('function');
    expect(typeof handle.onEnd).toBe('function');
  });

  it('onMove does not call dep methods', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
    const dep = makeAreaSelectDep();
    const ctx = makeCtx({ world: { x: 10, y: 20 }, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 50, y: 60 } });
    // No dep calls during move.
    expect(dep.calls.hitTestArea).toHaveLength(0);
    expect(dep.calls.setSelection).toHaveLength(0);
  });

  it('onEnd("commit") calls hitTestArea with correct bounds derived from start+current', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
    const dep = makeAreaSelectDep(['node-1']);
    const ctx = makeCtx({ world: { x: 10, y: 20 }, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 50, y: 60 } });
    handle.onEnd!({ ...ctx, world: { x: 50, y: 60 } }, 'commit');

    // bounds should be {x:10, y:20, width:40, height:40}.
    expect(dep.calls.hitTestArea).toHaveLength(1);
    expect(dep.calls.hitTestArea[0]).toEqual({ x: 10, y: 20, width: 40, height: 40 });
  });

  it('onEnd("commit") sets selection to hit nodes (replace mode)', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
    const dep = makeAreaSelectDep(['node-1', 'node-2']);
    const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 100, y: 100 } });
    handle.onEnd!({ ...ctx, world: { x: 100, y: 100 } }, 'commit');

    expect(dep.calls.setSelection).toHaveLength(1);
    expect(dep.calls.setSelection[0]).toEqual(['node-1', 'node-2']);
  });

  it('onEnd("commit") extends selection with shift held', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
    const dep = makeAreaSelectDep(['node-3'], ['node-1', 'node-2']);
    const ctx = makeCtx({ world: { x: 0, y: 0 }, shift: true, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 100, y: 100 } });
    handle.onEnd!({ ...ctx, world: { x: 100, y: 100 } }, 'commit');

    // Should extend: node-1, node-2 + node-3.
    expect(dep.calls.setSelection[0]).toEqual(['node-1', 'node-2', 'node-3']);
  });

  it('onEnd("commit") clears selection on zero-size marquee (click, no shift)', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
    const dep = makeAreaSelectDep([], ['node-1']);
    const ctx = makeCtx({ world: { x: 10, y: 20 }, dep });
    const handle = invoker.start(ctx, undefined);
    // No onMove → start === current → zero-size marquee.
    handle.onEnd!({ ...ctx }, 'commit');

    expect(dep.calls.hitTestArea).toHaveLength(0);
    expect(dep.calls.setSelection).toHaveLength(1);
    expect(dep.calls.setSelection[0]).toEqual([]);
  });

  it('onEnd("commit") preserves selection on zero-size marquee with shift held', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
    const dep = makeAreaSelectDep([], ['node-1']);
    const ctx = makeCtx({ world: { x: 10, y: 20 }, shift: true, dep });
    const handle = invoker.start(ctx, undefined);
    // Zero-size marquee + shift → no-op (don't clear).
    handle.onEnd!({ ...ctx }, 'commit');

    expect(dep.calls.setSelection).toHaveLength(0);
  });

  it('onEnd("cancel") does not call dep methods', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
    const dep = makeAreaSelectDep(['node-1']);
    const ctx = makeCtx({ world: { x: 0, y: 0 }, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 100, y: 100 } });
    handle.onEnd!({ ...ctx, world: { x: 100, y: 100 } }, 'cancel');

    expect(dep.calls.hitTestArea).toHaveLength(0);
    expect(dep.calls.setSelection).toHaveLength(0);
  });

  it('bounds are correctly oriented when drag goes in negative direction', () => {
    const invoker = getOngoingInvoker(areaSelectAction);
    const dep = makeAreaSelectDep();
    // Start at (100, 100), drag to (10, 20) — reverse direction.
    const ctx = makeCtx({ world: { x: 100, y: 100 }, dep });
    const handle = invoker.start(ctx, undefined);
    handle.onMove!({ ...ctx, world: { x: 10, y: 20 } });
    handle.onEnd!({ ...ctx, world: { x: 10, y: 20 } }, 'commit');

    // Should normalize to {x:10, y:20, width:90, height:80}.
    expect(dep.calls.hitTestArea[0]).toEqual({ x: 10, y: 20, width: 90, height: 80 });
  });
});
