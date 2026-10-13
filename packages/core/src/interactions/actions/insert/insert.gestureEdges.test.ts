import { describe, it, expect } from 'vitest';
import { insertAction } from './action';
import type { InvocationCtx } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { InsertBehavior } from '../../gestures/types';
import type { InsertDep } from '../depSchema';

function makeInsertDep() {
  const calls: Array<{ extras: unknown }> = [];
  const dep: InsertDep = {
    commit(_bounds, extras) {
      calls.push({ extras });
      return 'new-node-id' as NodeId;
    },
  };
  return { dep, calls };
}

function makeSelection(initial: string[]) {
  let ids = initial;
  return {
    get: () => ids,
    set: (next: string[]) => { ids = next; },
    clear: () => { ids = []; },
  };
}

function makeCtx(world: { x: number; y: number }, deps: Record<string, unknown>, shift = false): InvocationCtx {
  return {
    world,
    screen: world,
    modifiers: { alt: false, ctrl: false, meta: false, shift },
    deps,
  } as unknown as InvocationCtx;
}

function ongoing() {
  const invoker = insertAction.invoker!;
  if (invoker.timing !== 'ongoing') throw new Error('expected ongoing');
  return invoker;
}

describe('insertAction — selection across a canceled draw', () => {
  it('clears the selection while drawing and puts it back on cancel', () => {
    const selection = makeSelection(['a', 'b', 'c']);
    const deps = { insert: makeInsertDep().dep, selection };
    const handle = ongoing().start(makeCtx({ x: 0, y: 0 }, deps), { params: { kind: 'rect' } });
    expect(selection.get()).toEqual([]);
    handle.onMove!(makeCtx({ x: 40, y: 40 }, deps));
    handle.onEnd!(makeCtx({ x: 40, y: 40 }, deps), 'cancel');
    expect(selection.get()).toEqual(['a', 'b', 'c']);
  });
});

describe('insertAction — Shift on a line whose start a behavior moved', () => {
  it('measures the 15° constraint from the start the line is drawn from', () => {
    const { dep, calls } = makeInsertDep();
    // Stands in for a guide a few units from the press.
    const startOnGuide: InsertBehavior<unknown> = {
      onStart(ctx) { ctx.origin.set(ctx.draggedIds[0], { x: 0, y: 0 }); },
    };
    const deps = { insert: dep };
    const handle = ongoing().start(
      makeCtx({ x: 3, y: 9 }, deps),
      { params: { kind: 'line' }, behaviors: [startOnGuide] },
    );
    handle.onMove!(makeCtx({ x: 100, y: 10 }, deps, true));
    handle.onEnd!(makeCtx({ x: 100, y: 10 }, deps, true), 'commit');

    const { a, b } = calls[0].extras as { a: { x: number; y: number }; b: { x: number; y: number } };
    expect(a).toEqual({ x: 0, y: 0 });
    // Horizontal from the moved start, not from the press 9 units below it.
    expect(b.y).toBeCloseTo(0, 6);
  });
});
