import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { snapToContainer } from './snapToContainer';
import type { GestureContext, GroupTransform } from '../../../gestures/types';
import { moveEnd } from '../../testUtils';
import { createTransformOp } from 'core/ops/transform';

const tt = (dx: number, dy: number): GroupTransform => ({ kind: 'translate', dx, dy });
import type { SnapTarget } from 'core/adapters/types';

interface Pose { x: number; y: number }

function makeCtx(): GestureContext<Pose> {
  return {
    draggedIds: ['p1'],
    origin: new Map([['p1', { x: 0, y: 0 }]]),
    current: new Map([['p1', { x: 1, y: 1 }]]),
    snap: null,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    pointer: { worldX: 5, worldY: 5, clientX: 100, clientY: 100 },
    view: null,
    offset: (from, to) => ({ dx: to.x - from.x, dy: to.y - from.y }),
    adapter: { getParent: () => 'oldParent' } as any,
    scratch: {},
  };
}

/** A `MoveEnd` whose translate is the action's for a plain pose: from where
 *  each node started to where the drag put it. */
const translating = (ctx: GestureContext<Pose>) =>
  moveEnd((ids) => [...ids].map((id) =>
    createTransformOp<Pose>({ id, from: ctx.origin.get(id)!, to: ctx.current.get(id)!, label: 'Move' })));

describe('snapToContainer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sets snap state immediately when findTarget returns instant=true', () => {
    const target: SnapTarget<Pose> = { parentId: 'box', slotPose: { x: 2, y: 3 }, metadata: { instant: true } };
    const findTarget = vi.fn().mockReturnValue(target);
    const b = snapToContainer<Pose>({ dwellMs: 500, findTarget, isInstant: (t) => (t.metadata as any)?.instant });
    const ctx = makeCtx();
    const result = b.onMove!(ctx, tt(1, 1));
    expect(result).toEqual({ transform: tt(2, 3), poses: new Map([['p1', { x: 2, y: 3 }]]), snap: target });
  });

  it('does not snap until dwell elapses', () => {
    const target: SnapTarget<Pose> = { parentId: 'box', slotPose: { x: 2, y: 3 } };
    const findTarget = vi.fn().mockReturnValue(target);
    const b = snapToContainer<Pose>({ dwellMs: 500, findTarget });
    const ctx = makeCtx();
    const r1 = b.onMove!(ctx, tt(1, 1));
    expect(r1).toBeUndefined();
    vi.advanceTimersByTime(499);
    const r2 = b.onMove!(ctx, tt(1, 1));
    expect(r2).toBeUndefined();
  });

  it('snaps after dwell elapses on next onMove call', () => {
    const target: SnapTarget<Pose> = { parentId: 'box', slotPose: { x: 2, y: 3 } };
    const findTarget = vi.fn().mockReturnValue(target);
    const b = snapToContainer<Pose>({ dwellMs: 500, findTarget });
    const ctx = makeCtx();
    b.onMove!(ctx, tt(1, 1));
    vi.advanceTimersByTime(500);
    const r = b.onMove!(ctx, tt(1, 1));
    expect(r).toMatchObject({ transform: tt(2, 3), snap: target });
  });

  it('moving away from target before dwell cancels timer', () => {
    const target1: SnapTarget<Pose> = { parentId: 'box1', slotPose: { x: 2, y: 3 } };
    const findTarget = vi.fn().mockReturnValueOnce(target1).mockReturnValueOnce(null).mockReturnValue(target1);
    const b = snapToContainer<Pose>({ dwellMs: 500, findTarget });
    const ctx = makeCtx();
    b.onMove!(ctx, tt(1, 1));
    vi.advanceTimersByTime(200);
    b.onMove!(ctx, tt(10, 10));
    vi.advanceTimersByTime(500);
    expect(b.onMove!(ctx, tt(1, 1))).toBeUndefined();
  });

  it('onEnd emits [TransformOp, ReparentOp] when snapped to a new parent', () => {
    const target: SnapTarget<Pose> = { parentId: 'box', slotPose: { x: 2, y: 3 } };
    const b = snapToContainer<Pose>({ dwellMs: 0, findTarget: () => target });
    const ctx = makeCtx();
    b.onMove!(ctx, tt(1, 1));
    ctx.snap = target;
    const ops = b.onEnd!(ctx, moveEnd()) as any[];
    expect(ops.map((op) => op.name)).toEqual(['transform', 'reparent']);
    expect(ops[0].args).toMatchObject({ id: 'p1', to: { x: 2, y: 3 } });
    expect(ops[1].args).toMatchObject({ id: 'p1', toParentId: 'box' });
  });

  it('onEnd emits only TransformOp when snapped target equals old parent', () => {
    const target: SnapTarget<Pose> = { parentId: 'oldParent', slotPose: { x: 2, y: 3 } };
    const b = snapToContainer<Pose>({ dwellMs: 0, findTarget: () => target });
    const ctx = makeCtx();
    b.onMove!(ctx, tt(1, 1));
    ctx.snap = target;
    const ops = b.onEnd!(ctx, moveEnd());
    expect(ops!.length).toBe(1);
  });

  it('onEnd gives every dragged node its own slot in the snapped container', () => {
    const slots: Record<string, Pose> = { p1: { x: 2, y: 3 }, p2: { x: 12, y: 3 } };
    const findTarget = (id: string): SnapTarget<Pose> | null =>
      slots[id] ? { parentId: 'box', slotPose: slots[id] } : null;
    const b = snapToContainer<Pose>({ dwellMs: 0, findTarget, isInstant: () => true });
    const ctx = makeCtx();
    ctx.draggedIds = ['p1', 'p2', 'p3'];
    ctx.origin.set('p2', { x: 20, y: 0 }).set('p3', { x: 40, y: 0 });
    ctx.current.set('p2', { x: 21, y: 1 }).set('p3', { x: 41, y: 1 });
    ctx.adapter = { getParent: (id: string) => (id === 'p2' ? 'box' : 'oldParent') } as any;
    b.onMove!(ctx, tt(1, 1));
    const ops = b.onEnd!(ctx, translating(ctx)) as any[];
    const moves = ops.filter((op) => op.name === 'transform').map((op) => [op.args.id, op.args.to]);
    // p3 has no slot of its own, so it lands where the preview showed it.
    expect(moves).toEqual([['p1', { x: 2, y: 3 }], ['p2', { x: 12, y: 3 }], ['p3', { x: 41, y: 1 }]]);
    const reparents = ops.filter((op) => op.name === 'reparent').map((op) => [op.args.id, op.args.toParentId]);
    expect(reparents).toEqual([['p1', 'box'], ['p3', 'box']]);
  });

  it('onEnd defers (returns undefined) when no snap is active', () => {
    const b = snapToContainer<Pose>({ dwellMs: 0, findTarget: () => null });
    const ctx = makeCtx();
    expect(b.onEnd!(ctx, moveEnd())).toBeUndefined();
  });
});
