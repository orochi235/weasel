import { describe, expect, it } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { InsertDep, InsertEnds } from '../depSchema';
import { insertAction } from './action';

function drag(from: { x: number; y: number }, to: { x: number; y: number }, alt = false): InsertEnds | undefined {
  let ends: InsertEnds | undefined;
  const dep: InsertDep = {
    commit(_bounds, _extras, e) {
      ends = e;
      return 'n' as NodeId;
    },
  };
  const ctx = (world: { x: number; y: number }): InvocationCtx => ({
    world, screen: world, modifiers: { alt, ctrl: false, meta: false, shift: false }, deps: { insert: dep },
  });
  const invoker = insertAction.invoker;
  if (invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const handle = invoker.start(ctx(from), undefined);
  handle.onMove!(ctx(to));
  handle.onEnd!(ctx(to), 'commit');
  return ends;
}

describe('insertAction hands the insert dep the drag ends', () => {
  it('from where the drag started to where it ended, whichever way it went', () => {
    expect(drag({ x: 60, y: 70 }, { x: 10, y: 20 })).toEqual({ start: { x: 60, y: 70 }, end: { x: 10, y: 20 } });
  });

  it('saying so when the box grows from its center', () => {
    expect(drag({ x: 60, y: 70 }, { x: 10, y: 20 }, true))
      .toEqual({ start: { x: 60, y: 70 }, end: { x: 10, y: 20 }, fromCenter: true });
  });
});
