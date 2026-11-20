import { describe, expect, it } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import type { InsertBehavior, InsertDep, InsertExtras, InsertLive, InsertPoint } from '@weasel-js/core/engine';
import type { NodeId } from '@weasel-js/core';
import { insertAction } from './action';
import { insertRepositionAction } from './repositionAction';
import { GESTURE_KEY } from './session';

type Bounds = { x: number; y: number; width: number; height: number };

function scope() {
  const committed: Array<{ bounds: Bounds; extras: InsertExtras }> = [];
  const insert: InsertDep = { commit: (bounds, extras) => { committed.push({ bounds: { ...bounds }, extras }); return 'n' as NodeId; } };
  const insertLive: InsertLive = { gesture: null };
  const ctx = (x: number, y: number, shift = false): InvocationCtx => ({
    world: { x, y }, screen: { x, y },
    modifiers: { alt: false, ctrl: false, meta: false, shift },
    deps: { insert, insertLive },
  });
  return { committed, ctx };
}

function start(s: ReturnType<typeof scope>, kind: string, behavior: InsertBehavior<unknown>, x: number, y: number) {
  if (insertAction.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  return insertAction.invoker.start(s.ctx(x, y), { params: { kind }, behaviors: [behavior] });
}

describe('insert: a start a behavior shaped', () => {
  it('is the point a Shift-held line turns about', () => {
    const s = scope();
    const shifted: InsertBehavior<unknown> = {
      onMove: (gctx) => {
        const o = gctx.origin.get(GESTURE_KEY) as InsertPoint;
        return { start: { x: o.x + 10, y: o.y } };
      },
    };
    const h = start(s, 'line', shifted, 0, 0);
    h.onMove?.(s.ctx(57, 23, true));
    h.onEnd?.(s.ctx(57, 23, true), 'commit');
    const { a, b } = s.committed[0]!.extras as unknown as { a: InsertPoint; b: InsertPoint };
    expect(a).toEqual({ x: 10, y: 0 });
    const step = Math.PI / 12;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    expect(Math.abs(angle / step - Math.round(angle / step))).toBeLessThan(1e-9);
  });

  it('keeps its shaping when Space carries it', () => {
    const s = scope();
    const nudged: InsertBehavior<unknown> = {
      onStart: (gctx) => {
        const o = gctx.origin.get(GESTURE_KEY) as InsertPoint;
        gctx.origin.set(GESTURE_KEY, { x: o.x + 5, y: o.y });
      },
    };
    const h = start(s, 'rect', nudged, 10, 10);
    h.onMove?.(s.ctx(60, 40));
    if (insertRepositionAction.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const space = insertRepositionAction.invoker.start(s.ctx(0, 0), undefined);
    h.onMove?.(s.ctx(90, 70));
    space.onEnd?.(s.ctx(90, 70), 'commit');
    h.onMove?.(s.ctx(100, 90));
    h.onEnd?.(s.ctx(100, 90), 'commit');
    expect(s.committed[0]?.bounds).toEqual({ x: 45, y: 40, width: 55, height: 50 });
  });
});
