import { describe, it, expect, vi } from 'vitest';
import { insertAction } from './insert';
import { snapToGrid } from '../insert/behaviors/snapToGrid';
import { snapToGuides } from '../insert/behaviors/snapToGuides';
import type { InvocationCtx, BindingOpts, OngoingInvoker } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { InsertDep } from '../depSchema';
import type { InsertBehavior } from '../../gestures/types';
import type { View } from 'core/viewport/view';
import { createScene } from 'core/scene/scene';
import type { Op } from 'core/ops/types';

function makeInsertDep(): InsertDep & { calls: Array<{ bounds: unknown }> } {
  const calls: Array<{ bounds: unknown }> = [];
  return {
    calls,
    commit(bounds) {
      calls.push({ bounds: { ...bounds } });
      return 'new-node-id' as NodeId;
    },
  };
}

function ctxAt(
  world: { x: number; y: number },
  deps: Record<string, unknown>,
  modifiers: Partial<InvocationCtx['modifiers']> = {},
): InvocationCtx {
  return {
    world,
    screen: world,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false, ...modifiers },
    deps,
  };
}

const invoker = insertAction.invoker as OngoingInvoker;

/** Drag from `a` to `b` with `behaviors` on the binding; returns the live
 *  preview (read before release) and what reached the insert dep. */
function drag(
  a: { x: number; y: number },
  b: { x: number; y: number },
  behaviors: InsertBehavior<unknown>[],
  deps: Record<string, unknown> = {},
) {
  const dep = makeInsertDep();
  const opts: BindingOpts = { params: { kind: 'rect' }, behaviors };
  const handle = invoker.start(ctxAt(a, { insert: dep, ...deps }), opts);
  handle.onMove!(ctxAt(b, {}));
  const preview = handle.overlay!();
  handle.onEnd!(ctxAt(b, {}), 'commit');
  return { preview, dep };
}

describe('insertAction behavior pipeline', () => {
  it('snapToGrid snaps both the committed node and the live preview', () => {
    const { preview, dep } = drag({ x: 7, y: 12 }, { x: 53, y: 48 }, [snapToGrid({ spacing: 10 })]);
    const snapped = { x: 10, y: 10, width: 40, height: 40 };
    expect(preview).toMatchObject({ kind: 'insertPreview', bounds: snapped, anchorPoint: { x: 10, y: 10 } });
    expect(dep.calls).toEqual([{ bounds: snapped }]);
  });

  it('runs behaviors in order, each seeing the points the last one shaped', () => {
    const seen: unknown[] = [];
    const first: InsertBehavior<unknown> = { onMove: () => ({ current: { x: 100, y: 100 } }) };
    const second: InsertBehavior<unknown> = {
      onMove: (_ctx, p) => { seen.push(p.current, p.bounds); },
    };
    const { dep } = drag({ x: 0, y: 0 }, { x: 5, y: 5 }, [first, second]);
    expect(seen).toEqual([{ x: 100, y: 100 }, { x: 0, y: 0, width: 100, height: 100 }]);
    expect(dep.calls[0].bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
  });

  it('hands behaviors the view the gesture landed in', () => {
    const view = { x: 0, y: 0, scale: { x: 0.5, y: 0.5 } } as unknown as View;
    const viewApi = { get: () => view };
    // 6 screen px at half zoom is 12 world units: a guide 8 units off snaps,
    // where the no-view reading (6 units) would leave it.
    const guides = snapToGuides({ getGuides: () => [{ id: 'g', axis: 'x', offset: 50 }], tolerance: 6 });
    const { dep } = drag({ x: 0, y: 0 }, { x: 58, y: 40 }, [guides], { view: viewApi });
    expect(dep.calls[0].bounds).toEqual({ x: 0, y: 0, width: 50, height: 40 });
  });

  it('an onEnd returning null aborts the insert', () => {
    const { dep } = drag({ x: 0, y: 0 }, { x: 50, y: 50 }, [{ onEnd: () => null }]);
    expect(dep.calls).toEqual([]);
  });

  it('an onEnd returning ops commits them in place of the insert', () => {
    const scene = createScene<unknown, 'main', unknown>({ systemLayers: [{ id: 'main' }] });
    const apply = vi.fn();
    const op: Op = { label: 'claimed', apply, invert: () => op };
    const { dep } = drag({ x: 0, y: 0 }, { x: 50, y: 50 }, [{ onEnd: () => [op] }], { scene });
    expect(dep.calls).toEqual([]);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('fires onStart once; a cancel runs no onEnd and commits nothing', () => {
    const onStart = vi.fn();
    const onEnd = vi.fn();
    const dep = makeInsertDep();
    const handle = invoker.start(ctxAt({ x: 0, y: 0 }, { insert: dep }), { behaviors: [{ onStart, onEnd }] });
    handle.onMove!(ctxAt({ x: 10, y: 10 }, {}));
    handle.onEnd!(ctxAt({ x: 10, y: 10 }, {}), 'cancel');
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    expect(dep.calls).toEqual([]);
  });
});
