import { describe, expect, it, vi } from 'vitest';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { View } from 'core/viewport/view';
import { stubDeps } from 'interactions/actions/testUtils';
import { createSymmetryStore } from './store';
import { SYMMETRY_AFFORDANCE_KIND, symmetryAxisLayer } from './axisLayer';
import { symmetryAxisDragAction } from './axisDrag';
import { symmetryContribution } from './contribution';

const VIEW: View = { x: 0, y: 0, scale: { x: 2, y: 2 } };
const DIMS = { width: 400, height: 300 };

describe('createSymmetryStore', () => {
  it('holds the setting and tells subscribers when it changes', () => {
    const store = createSymmetryStore();
    const heard = vi.fn();
    store.subscribe(heard);
    expect(store.get()).toBeNull();
    store.set({ axis: 'both', center: { x: 1, y: 2 } });
    expect(store.get()).toEqual({ axis: 'both', center: { x: 1, y: 2 } });
    store.set(null);
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe('symmetryAxisLayer', () => {
  const store = createSymmetryStore({ axis: 'both', center: { x: 50, y: 40 } });
  const layer = symmetryAxisLayer({ get: store.get });

  it('draws nothing while symmetry is off', () => {
    const off = symmetryAxisLayer({ get: () => null });
    expect(off.draw(undefined, VIEW, DIMS)).toEqual([]);
    expect(off.hitTest!(50, 40, undefined, VIEW, DIMS)).toBeNull();
  });

  it('draws each axis and the handle where they cross', () => {
    expect(layer.draw(undefined, VIEW, DIMS)).toHaveLength(3);
  });

  it('claims a press on the handle, measured in screen pixels', () => {
    const hit = layer.hitTest!(53, 40, undefined, VIEW, DIMS);
    expect(hit).toMatchObject({ strength: 'exclusive', cursor: 'move' });
    expect(layer.hitTest!(56, 40, undefined, VIEW, DIMS)).toBeNull();
  });

  it('leaves the rest of the axis to the tools, so a stroke can start on it', () => {
    expect(layer.hitTest!(50, 100, undefined, VIEW, DIMS)).toBeNull();
  });

  it('names the layer the contribution binds its drag to', () => {
    expect(SYMMETRY_AFFORDANCE_KIND).toBe(`layer:${layer.id}`);
  });
});

function dragAxis(store: ReturnType<typeof createSymmetryStore>, to: { x: number; y: number }, snap?: (p: { x: number; y: number }) => { x: number; y: number }) {
  const from = { x: 50, y: 40 };
  const ctx: InvocationCtx = {
    world: from,
    screen: from,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: stubDeps({ symmetry: store, ...(snap ? { snap: { point: snap } } : {}) }),
    drag: { start: from, current: from, delta: { x: 0, y: 0 } },
  };
  const invoker = symmetryAxisDragAction.invoker;
  if (invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle: OngoingHandle = invoker.start(ctx, undefined);
  handle.onMove!({ ...ctx, deps: {}, world: to });
  return handle;
}

describe('symmetryAxisDragAction', () => {
  it('moves a vertical axis sideways only', () => {
    const store = createSymmetryStore({ axis: 'vertical', center: { x: 50, y: 40 } });
    dragAxis(store, { x: 70, y: 90 }).onEnd!({} as InvocationCtx, 'commit');
    expect(store.get()?.center).toEqual({ x: 70, y: 40 });
  });

  it('moves the crossing of both axes freely, through the snap', () => {
    const store = createSymmetryStore({ axis: 'both', center: { x: 50, y: 40 } });
    dragAxis(store, { x: 73, y: 58 }, (p) => ({ x: Math.round(p.x / 10) * 10, y: Math.round(p.y / 10) * 10 }));
    expect(store.get()?.center).toEqual({ x: 70, y: 60 });
  });

  it('puts the axis back on cancel', () => {
    const store = createSymmetryStore({ axis: 'horizontal', center: { x: 50, y: 40 } });
    dragAxis(store, { x: 70, y: 90 }).onEnd!({} as InvocationCtx, 'cancel');
    expect(store.get()?.center).toEqual({ x: 50, y: 40 });
  });
});

describe('symmetryContribution', () => {
  it('publishes the store as the symmetry dep and binds the axis drag', () => {
    const store = createSymmetryStore();
    const entry = symmetryContribution(store);
    expect(entry.deps?.symmetry?.()).toBe(store);
    expect(entry.actions?.map((a) => a.id)).toEqual([symmetryAxisDragAction.id]);
    expect(entry.bindings?.[0].actionId).toBe(symmetryAxisDragAction.id);
  });
});
