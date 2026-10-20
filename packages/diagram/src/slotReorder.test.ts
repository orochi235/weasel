import { describe, expect, it, vi } from 'vitest';
import { overlaysOf, type InvocationCtx, type OngoingHandle } from '@weasel-js/core';
import { createReorderAction, reorderContribution, sequenceSlots, REORDER_ACTION_ID, type ReorderOptions } from './slotReorder';

const box = (x: number, y: number, width = 100, height = 40) => ({ x, y, width, height });

/** Three boxes in a row, 40 apart: a at 0, b at 140, c at 280. */
const SLOTS = sequenceSlots('x', [
  { id: 'a', bounds: box(0, 0) },
  { id: 'b', bounds: box(140, 0) },
  { id: 'c', bounds: box(280, 10, 100, 60) },
]);

const scene = { get: (id: string) => ({ id, pose: SLOTS.items.find((i) => i.id === id)?.bounds }) };

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

describe('createReorderAction', () => {
  it('takes a press only on an item’s grip', () => {
    const action = createReorderAction({
      slots: () => ({ ...SLOTS, items: SLOTS.items.map((i) => ({ ...i, grip: box(i.bounds.x, i.bounds.y, 20, 20) })) }),
      commit: () => {},
    });
    expect(action.enabled!({ scene }, { x: 150, y: 10 })).toBe(true);
    expect(action.enabled!({ scene }, { x: 190, y: 30 })).not.toBe(true);
    expect(action.enabled!({ scene }, { x: 130, y: 10 })).not.toBe(true);
  });

  it('commits the item’s place and the gap nearest the pointer', () => {
    const { handle, commit } = open();
    handle.onMove!(ctx(250, 20));
    handle.onEnd!(ctx(250, 20), 'commit');
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![0]).toEqual({ id: 'a', from: 0, to: 2 });
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
    expect(c.bindings).toEqual([expect.objectContaining({ spec: { kind: 'drag' }, actionId: REORDER_ACTION_ID })]);
  });
});
