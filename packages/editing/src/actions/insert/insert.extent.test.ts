import { describe, expect, it } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import type { InsertDep, InsertExtras } from '@weasel-js/core/engine';
import type { NodeId } from '@weasel-js/core';
import { insertAction } from './action';

function scope() {
  const committed: InsertExtras[] = [];
  const insert: InsertDep = { commit: (_b, extras) => { committed.push(extras); return 'n' as NodeId; } };
  const ctx = (x: number, y: number): InvocationCtx => ({
    world: { x, y },
    screen: { x, y },
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    deps: { insert },
  });
  return { committed, ctx };
}

function drag(params: Record<string, unknown>, to: { x: number; y: number }): InsertExtras[] {
  const s = scope();
  if (insertAction.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
  const h = insertAction.invoker.start(s.ctx(100, 100), { params });
  h.onMove?.(s.ctx(to.x, to.y));
  h.onEnd?.(s.ctx(to.x, to.y), 'commit');
  return s.committed;
}

describe('insert: what a drag must make to commit', () => {
  it.each(['polygon', 'star'])('commits a from-center %s drawn by a level drag', (kind) => {
    const committed = drag({ kind, originMode: 'center' }, { x: 160, y: 100 });
    expect(committed).toHaveLength(1);
    expect(committed[0]).toMatchObject({ kind, center: { x: 100, y: 100 } });
  });

  it('still commits nothing for a corner polygon drawn by a level drag', () => {
    expect(drag({ kind: 'polygon' }, { x: 160, y: 100 })).toHaveLength(0);
  });
});
