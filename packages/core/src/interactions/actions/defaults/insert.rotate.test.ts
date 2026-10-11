import { describe, expect, it } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import { insertAction, insertRotateAction } from './insert';
import type { InsertDep, InsertExtras, InsertLive } from '../depSchema';
import type { NodeId } from 'core/scene/types';

/** One canvas's input scope: its own insert dep and its own live-gesture holder. */
function scope() {
  const committed: InsertExtras[] = [];
  const insert: InsertDep = { commit: (_bounds, extras) => { committed.push(extras); return 'n' as NodeId; } };
  const insertLive: InsertLive = { gesture: null };
  const ctx = (x: number, y: number): InvocationCtx => ({
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { insert, insertLive },
  });
  return { committed, insertLive, ctx };
}

function start(s: ReturnType<typeof scope>) {
  if (insertAction.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  return insertAction.invoker.start(s.ctx(0, 0), { params: { kind: 'polygon', sides: 5, rotation: 0 } });
}

function rotate(s: ReturnType<typeof scope>, deltaY: number): void {
  if (insertRotateAction.invoker?.timing !== 'immediate') throw new Error('expected an immediate invoker');
  insertRotateAction.invoker.run({ insertLive: s.insertLive }, { deltaY });
}

const rotationOf = (extras: InsertExtras): number => (extras as { rotation: number }).rotation;

describe('insert.adjustRotation', () => {
  it('turns the insert in flight in its own scope', () => {
    const a = scope();
    const handle = start(a);
    rotate(a, 180);
    handle.onMove?.(a.ctx(40, 40));
    handle.onEnd?.(a.ctx(40, 40), 'commit');
    expect(rotationOf(a.committed[0])).toBeCloseTo(Math.PI / 4);
  });

  it('leaves an insert in flight in another scope alone', () => {
    const a = scope();
    const b = scope();
    const handle = start(a);
    rotate(b, 180);
    handle.onMove?.(a.ctx(40, 40));
    handle.onEnd?.(a.ctx(40, 40), 'commit');
    expect(rotationOf(a.committed[0])).toBe(0);
  });

  it('lets go of the gesture when it ends', () => {
    const a = scope();
    const handle = start(a);
    expect(a.insertLive.gesture).not.toBeNull();
    handle.onEnd?.(a.ctx(0, 0), 'cancel');
    expect(a.insertLive.gesture).toBeNull();
  });
});
