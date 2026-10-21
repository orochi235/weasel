import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { insertAction } from './action';
import { insertRepositionAction } from './repositionAction';
import type { InsertDep, InsertExtras, InsertLive } from '../depSchema';
import type { NodeId } from 'core/scene/types';
import { createScene } from 'core/scene/scene';
import { gridSource, sessionDep } from 'features/snap/testing/sessionDep';

type Bounds = { x: number; y: number; width: number; height: number };

function scope(gridStep?: number) {
  const committed: Array<{ bounds: Bounds; extras: InsertExtras }> = [];
  const insert: InsertDep = {
    commit: (bounds, extras) => { committed.push({ bounds: { ...bounds }, extras }); return 'n' as NodeId; },
  };
  const insertLive: InsertLive = { gesture: null };
  const snap = gridStep ? sessionDep(createScene({ systemLayers: [{ id: 'main' }] }) as never, [gridSource(gridStep)]) : null;
  const ctx = (x: number, y: number): InvocationCtx => ({
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { insert, insertLive, ...(snap ? { snap } : {}) },
  });
  return { committed, insertLive, ctx };
}

function draw(s: ReturnType<typeof scope>, kind: string, x: number, y: number): OngoingHandle {
  if (insertAction.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  return insertAction.invoker.start(s.ctx(x, y), { params: { kind } });
}

function holdSpace(s: ReturnType<typeof scope>): OngoingHandle {
  if (insertRepositionAction.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  return insertRepositionAction.invoker.start(s.ctx(0, 0), undefined);
}

describe('insert.reposition', () => {
  it('moves the rect being drawn while held, then resizes from where it landed', () => {
    const s = scope();
    const draw$ = draw(s, 'rect', 10, 10);
    draw$.onMove?.(s.ctx(60, 40));
    const space = holdSpace(s);
    draw$.onMove?.(s.ctx(90, 70));
    space.onEnd?.(s.ctx(90, 70), 'commit');
    draw$.onMove?.(s.ctx(100, 90));
    draw$.onEnd?.(s.ctx(100, 90), 'commit');
    expect(s.committed[0]?.bounds).toEqual({ x: 40, y: 40, width: 60, height: 50 });
  });

  it('carries both ends of a line', () => {
    const s = scope();
    const draw$ = draw(s, 'line', 0, 0);
    draw$.onMove?.(s.ctx(20, 10));
    holdSpace(s);
    draw$.onMove?.(s.ctx(25, 30));
    draw$.onEnd?.(s.ctx(25, 30), 'commit');
    expect(s.committed[0]?.extras).toMatchObject({ kind: 'line', a: { x: 5, y: 20 }, b: { x: 25, y: 30 } });
  });

  it('keeps a grid-snapped start on the grid', () => {
    const s = scope(10);
    const draw$ = draw(s, 'rect', 0, 0);
    draw$.onMove?.(s.ctx(31, 19));
    holdSpace(s);
    draw$.onMove?.(s.ctx(47, 26));
    draw$.onEnd?.(s.ctx(47, 26), 'commit');
    expect(s.committed[0]?.bounds).toEqual({ x: 20, y: 10, width: 30, height: 20 });
  });

  it('does nothing with no insert in flight', () => {
    const s = scope();
    expect(holdSpace(s)).toEqual({});
  });
});
