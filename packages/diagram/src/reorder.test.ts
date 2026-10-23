import { describe, expect, it, vi } from 'vitest';
import { ActionDisabledReason, createScene, overlaysOf, type InvocationCtx, type OngoingHandle, type Scene } from '@weasel-js/core';
import { createReorderAction, reorderContribution, sequenceSlots, REORDER_ACTION_ID, type ReorderOptions } from './reorder';

const box = (x: number, y: number, width = 100, height = 40) => ({ x, y, width, height });

/** Three boxes in a row, 40 apart: a at 0, b at 140, c at 280. */
const SLOTS = sequenceSlots('x', [
  { id: 'a', bounds: box(0, 0) },
  { id: 'b', bounds: box(140, 0) },
  { id: 'c', bounds: box(280, 10, 100, 60) },
]);

const scene = { get: (id: string) => ({ id, pose: SLOTS.items.find((i) => i.id === id)?.bounds }) } as unknown as Scene<unknown, string, unknown>;

function ctx(x: number, y: number, start = { x: 20, y: 20 }): InvocationCtx {
  return {
    world: { x, y },
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    deps: { scene },
    drag: { start, current: { x, y }, delta: { x: x - start.x, y: y - start.y } },
  } as unknown as InvocationCtx;
}

function open(opts: Partial<ReorderOptions> = {}, start = { x: 20, y: 20 }): { handle: OngoingHandle; commit: ReturnType<typeof vi.fn> } {
  const commit = vi.fn();
  const action = createReorderAction({ slots: () => SLOTS, commit, ...opts });
  if (action.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  return { handle: action.invoker.start(ctx(start.x, start.y, start)), commit };
}

describe('sequenceSlots', () => {
  it('puts a gap between each pair of items, halfway, spanning both', () => {
    expect(SLOTS.gaps).toEqual([
      { index: 0, a: { x: -20, y: 0 }, b: { x: -20, y: 40 } },
      { index: 1, a: { x: 120, y: 0 }, b: { x: 120, y: 40 } },
      { index: 2, a: { x: 260, y: 0 }, b: { x: 260, y: 70 } },
      { index: 3, a: { x: 400, y: 10 }, b: { x: 400, y: 70 } },
    ]);
  });

  it('runs down the y axis too', () => {
    const slots = sequenceSlots('y', [{ id: 'a', bounds: box(0, 0) }, { id: 'b', bounds: box(0, 60) }]);
    expect(slots.gaps.map((g) => g.a)).toEqual([{ x: 0, y: -10 }, { x: 0, y: 50 }, { x: 0, y: 110 }]);
  });
});

describe('createReorderAction with the insertion bar', () => {
  it('takes a press only on an item’s grip', () => {
    const action = createReorderAction({
      slots: () => ({ ...SLOTS, items: SLOTS.items.map((i) => ({ ...i, grip: box(i.bounds.x, i.bounds.y, 20, 20) })) }),
      commit: () => {},
    });
    expect(action.enabled!({ scene }, { x: 150, y: 10 })).toBe(true);
    expect(action.enabled!({ scene }, { x: 190, y: 30 })).not.toBe(true);
    expect(action.enabled!({ scene }, { x: 130, y: 10 })).not.toBe(true);
  });

  it('never picks up an item whose grip is null, but still gaps around it', () => {
    const slots = sequenceSlots('x', [
      { id: 'a', bounds: box(0, 0, 10, 10), grip: null },
      { id: 'b', bounds: box(20, 0, 10, 10) },
    ]);
    const action = createReorderAction({ slots: () => slots, commit: () => {} });
    expect(action.enabled!({ scene }, { x: 5, y: 5 })).toBe(ActionDisabledReason.NotApplicable);
    expect(action.enabled!({ scene }, { x: 25, y: 5 })).toBe(true);
    expect(slots.gaps.map((g) => g.index)).toEqual([0, 1, 2]);
  });

  it('carries every id in carries under a bar drag, each by the drag offset', () => {
    const poses: Record<string, ReturnType<typeof box>> = { g: box(0, 0), m1: box(50, 100), m2: box(80, 200) };
    const carryScene = { get: (id: string) => ({ id, pose: poses[id] }) } as unknown as Scene<unknown, string, unknown>;
    const slots = sequenceSlots('x', [{ id: 'g', bounds: box(0, 0), carries: ['g', 'm1', 'm2'] }, { id: 'b', bounds: box(140, 0) }]);
    const action = createReorderAction({ slots: () => slots, commit: () => {} });
    if (action.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const start = { x: 20, y: 20 };
    const handle = action.invoker.start({ ...ctx(20, 20, start), deps: { scene: carryScene } } as InvocationCtx);
    handle.onMove!({ ...ctx(50, 20, start), deps: { scene: carryScene } } as InvocationCtx);
    expect([...handle.previewIds!()!]).toEqual(['g', 'm1', 'm2']);
    expect(handle.previewPose!('m1')).toEqual(box(80, 100));
    expect(handle.previewPose!('m2')).toEqual(box(110, 200));
    expect(handle.previewPose!('b')).toBeNull();
    expect([...handle.previewOpaqueIds!()!]).toEqual(['g', 'm1', 'm2']);
  });

  it('commits the item’s place and the gap nearest the pointer', () => {
    const { handle, commit } = open();
    handle.onMove!(ctx(250, 20));
    handle.onEnd!(ctx(250, 20), 'commit');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![0]).toEqual({ id: 'a', from: 0, to: 2, order: ['b', 'a', 'c'] });
  });

  it('carries the item along the axis only, as a preview', () => {
    const { handle } = open();
    handle.onMove!(ctx(250, 90));
    expect([...handle.previewIds!()!]).toEqual(['a']);
    expect(handle.previewPose!('a')).toEqual(box(230, 0));
  });

  it('draws an insertion bar at the gap, and a refused one where the drop cannot land', () => {
    const { handle } = open({ canDrop: (m) => m.to !== 3 });
    handle.onMove!(ctx(250, 20));
    expect(overlaysOf(handle)).toEqual([{ kind: 'polyline', points: [{ x: 260, y: 0 }, { x: 260, y: 70 }], role: 'insert' }]);
    handle.onMove!(ctx(395, 20));
    expect(overlaysOf(handle)).toEqual([{ kind: 'polyline', points: [{ x: 400, y: 10 }, { x: 400, y: 70 }], role: 'refused' }]);
  });

  it('asks canDrop about a gap once a drag, however often the bar is drawn', () => {
    const canDrop = vi.fn(() => true);
    const { handle } = open({ canDrop });
    handle.onMove!(ctx(250, 20));
    for (let i = 0; i < 3; i++) overlaysOf(handle);
    handle.onEnd!(ctx(250, 20), 'commit');
    expect(canDrop).toHaveBeenCalledTimes(1);
  });

  it('does nothing on a refused drop, a drop where it was, or a cancel', () => {
    const refused = open({ canDrop: () => false });
    refused.handle.onEnd!(ctx(250, 20), 'commit');
    expect(refused.commit).not.toHaveBeenCalled();

    const still = open();
    still.handle.onMove!(ctx(110, 20));
    expect(overlaysOf(still.handle)).toEqual([]);
    still.handle.onEnd!(ctx(110, 20), 'commit');
    expect(still.commit).not.toHaveBeenCalled();

    const canceled = open();
    canceled.handle.onEnd!(ctx(250, 20), 'cancel');
    expect(canceled.commit).not.toHaveBeenCalled();
  });

  it('packs into a contribution binding a drag to the action', () => {
    const c = reorderContribution({ slots: () => SLOTS, commit: () => {} });
    expect(c.actions!.map((a) => a.id)).toEqual([REORDER_ACTION_ID]);
    expect(c.bindings).toEqual([expect.objectContaining({ spec: expect.objectContaining({ kind: 'drag' }), actionId: REORDER_ACTION_ID })]);
  });
});

describe('createReorderAction sliding the others', () => {
  /** Three boxes down a column: a at 0 (40 tall), b at 50 (20), c at 80 (40). `a.title` travels with a. */
  function column() {
    const scene = createScene<unknown, 'main', ReturnType<typeof box>>({ systemLayers: [{ id: 'main' }] });
    const spans = { a: [0, 40], b: [50, 20], c: [80, 40] } as const;
    for (const [id, [y, h]] of Object.entries(spans)) scene.add({ id: id as never, kind: 'mark', layer: 'main', pose: box(0, y, 100, h), data: {} });
    scene.add({ id: 'a.title' as never, kind: 'mark', layer: 'main', pose: box(10, 5, 50, 10), data: {} });
    const slots = sequenceSlots('y', Object.entries(spans).map(([id, [y, h]]) => ({
      id, bounds: box(0, y, 100, h), ...(id === 'a' ? { carries: ['a', 'a.title'] } : {}),
    })));
    return { scene, slots };
  }

  function press(id: 'a' | 'c', commit = vi.fn()) {
    const { scene, slots } = column();
    const start = { x: 50, y: id === 'a' ? 20 : 100 };
    const at = (dy: number) => ({ ...ctx(start.x, start.y + dy, start), deps: { scene } }) as InvocationCtx;
    const action = createReorderAction({ slots: () => slots, show: 'slide', commit });
    if (action.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const handle = action.invoker.start(at(0));
    const ys = () => Object.fromEntries(['a', 'b', 'c', 'a.title'].map((n) => [n, scene.overrides.read(n as never)?.pose?.y]));
    return { scene, handle, at, ys, commit };
  }

  it('moves an item past each middle it crosses, the others sliding into their places', () => {
    const down = press('a');
    down.handle.onMove!(down.at(30));
    expect(down.ys()).toEqual({ a: 30, b: 50, c: 80, 'a.title': 35 });
    down.handle.onMove!(down.at(45));
    expect(down.ys()).toEqual({ a: 45, b: 0, c: 80, 'a.title': 50 });

    const up = press('c');
    up.handle.onMove!(up.at(-80));
    expect(up.ys()).toMatchObject({ a: 50, b: 100, c: 0 });
  });

  it('draws no insertion bar and previews nothing of its own', () => {
    const { handle, at } = press('a');
    handle.onMove!(at(45));
    expect(overlaysOf(handle)).toEqual([]);
    expect(handle.previewIds?.() ?? null).toBeNull();
  });

  it('commits the new order and holds the slid places until the scene changes', () => {
    const { scene, handle, at, commit } = press('a');
    handle.onMove!(at(45));
    handle.onEnd!(at(45), 'commit');
    expect(commit.mock.calls[0]![0]).toEqual({ id: 'a', from: 0, to: 2, order: ['b', 'a', 'c'] });
    expect(scene.overrides.read('b' as never)?.pose?.y).toBe(0);
    scene.add({ id: 'd' as never, kind: 'mark', layer: 'main', pose: box(0, 0), data: {} });
    expect(scene.overrides.has('b' as never)).toBe(false);
  });

  it('lets every place go at once on a cancel or a drop where it was', () => {
    const canceled = press('a');
    canceled.handle.onMove!(canceled.at(45));
    canceled.handle.onEnd!(canceled.at(45), 'cancel');
    expect(canceled.scene.overrides.has('b' as never)).toBe(false);
    expect(canceled.commit).not.toHaveBeenCalled();

    const still = press('a');
    still.handle.onMove!(still.at(10));
    still.handle.onEnd!(still.at(10), 'commit');
    expect(still.scene.overrides.has('a' as never)).toBe(false);
    expect(still.commit).not.toHaveBeenCalled();
  });
});
