import { describe, expect, it } from 'vitest';
import type { InvocationCtx } from '@weasel-js/routing';
import type { InsertBehavior, InsertDep } from '@weasel-js/core/engine';
import { createScene } from '@weasel-js/core/engine';
import * as ops from '@weasel-js/core/ops';
import type { NodeId } from '@weasel-js/core';
import { insertAction } from './action';

describe('insert: a behavior that answers with a selection', () => {
  it('leaves its selection standing, and undo puts back the one the press cleared', () => {
    const scene = createScene({ systemLayers: [{ id: 'main' }] });
    let sel: string[] = ['a'];
    const operands = { get: () => sel, clear: () => { sel = []; }, set: (next: readonly string[]) => { sel = [...next]; } };
    const insert: InsertDep = { commit: () => 'n' as NodeId };
    const ctx = (x: number, y: number): InvocationCtx => ({
      world: { x, y }, screen: { x, y }, modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { insert, scene, operands },
    } as unknown as InvocationCtx);
    const selects: InsertBehavior<unknown> = { onEnd: () => [ops.setSelection({ from: [], to: ['x'] })] };
    if (insertAction.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const h = insertAction.invoker.start(ctx(0, 0), { params: { kind: 'rect' }, behaviors: [selects] });
    h.onMove?.(ctx(20, 20));
    h.onEnd?.(ctx(20, 20), 'commit');
    expect(sel).toEqual(['x']);
    scene.undo();
    expect(sel).toEqual(['a']);
  });
});
