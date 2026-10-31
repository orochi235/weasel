import { describe, expect, it } from 'vitest';
import type { InvocationCtx, OngoingInvoker } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { InsertDep } from '../depSchema';
import { insertAction } from './action';
import { insertParams, POLYGON_INSERT_PARAMS, STAR_INSERT_PARAMS } from './params';

function dep(): InsertDep & { extras: Record<string, unknown>[] } {
  const extras: Record<string, unknown>[] = [];
  return { extras, commit: (_bounds, e) => { extras.push(e as never); return 'n' as NodeId; } };
}

const ctx = (insert: InsertDep, x: number, y: number): InvocationCtx => ({
  world: { x, y }, screen: { x, y }, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps: { insert },
});

describe('insert as the last operation', () => {
  it('shows a polygon\'s sides and a star\'s points and inner radius, and nothing for another kind', () => {
    expect(insertParams({ kind: 'polygon' })).toBe(POLYGON_INSERT_PARAMS);
    expect(insertParams({ kind: 'star' })).toBe(STAR_INSERT_PARAMS);
    expect(insertParams({ kind: 'rect' })).toBeNull();
  });

  it('replays the drag with the params it is handed, in the same place', () => {
    const insert = dep();
    const invoker = insertAction.invoker as OngoingInvoker;
    const handle = invoker.start(ctx(insert, 0, 0), { params: { kind: 'polygon', sides: 6 } });
    handle.onMove!(ctx(insert, 40, 30));
    handle.onEnd!(ctx(insert, 40, 30), 'commit');
    handle.replay!({ kind: 'polygon', sides: 9 });
    expect(insert.extras.map((e) => e.sides)).toEqual([6, 9]);
    expect(insert.extras[1].rotation).toBe(insert.extras[0].rotation);
  });

  it('does not replay a drag that behaviors answer', () => {
    const insert = dep();
    const invoker = insertAction.invoker as OngoingInvoker;
    const handle = invoker.start(ctx(insert, 0, 0), { params: { kind: 'polygon' }, behaviors: [{}] });
    expect(handle.replay).toBeUndefined();
  });
});
