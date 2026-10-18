import { describe, it, expect } from 'vitest';
import type { ActionDeps, BindingOpts, InvocationCtx } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import type { InsertDep, SnapDep } from '../depSchema';
import { insertAction } from './action';
import { placeAction } from './placeAction';

function makeInsertDep(): InsertDep & { calls: Array<{ bounds: unknown; extras: Record<string, unknown> }> } {
  const calls: Array<{ bounds: unknown; extras: Record<string, unknown> }> = [];
  return {
    calls,
    commit(bounds, extras) {
      calls.push({ bounds: { ...bounds }, extras: extras as Record<string, unknown> });
      return 'new' as NodeId;
    },
  };
}

function makeTextEditDep() {
  const calls: Array<{ id: string; opts?: { caret?: number | 'all' } }> = [];
  return { calls, startEdit(id: string, opts?: { caret?: number | 'all' }) { calls.push({ id, opts }); } };
}

function makeSelection(ids: string[]) {
  let sel = [...ids];
  return { get: () => sel, clear: () => { sel = []; }, set: (next: string[]) => { sel = [...next]; } };
}

/** A click as the dispatcher hands one to an immediate action: the binding's
 *  params with the click's world and press points laid under them. */
function click(params: Record<string, unknown>, deps: Partial<ActionDeps>, at = { x: 100, y: 50 }) {
  if (placeAction.invoker?.timing !== 'immediate') throw new Error('expected an immediate invoker');
  placeAction.invoker.run(deps as ActionDeps, { worldX: at.x, worldY: at.y, pressX: at.x, pressY: at.y, ...params });
}

describe('placeAction — a minimum size', () => {
  it('places a node no smaller than the binding\'s minSize, centered on the click', () => {
    const insert = makeInsertDep();
    const minSize = { width: 48, height: 30 };
    click({ kind: 'sticky', size: { width: 40, height: 40 }, minSize }, { insert });
    expect(insert.calls[0].bounds).toEqual({ x: 76, y: 30, width: 48, height: 40 });
    expect(insert.calls[0].extras.minSize).toEqual(minSize);
  });
});

describe('placeAction', () => {
  it('commits a node of the binding\'s kind and size, centered on the click', () => {
    const insert = makeInsertDep();
    click({ kind: 'sticky', size: { width: 40, height: 20 } }, { insert });
    expect(insert.calls).toHaveLength(1);
    expect(insert.calls[0].bounds).toEqual({ x: 80, y: 40, width: 40, height: 20 });
    expect(insert.calls[0].extras.kind).toBe('sticky');
  });

  it('hands the binding\'s params on as extras, and none of the click\'s', () => {
    const insert = makeInsertDep();
    click({ kind: 'sticky', size: { width: 40, height: 20 }, padding: 4 }, { insert });
    expect(insert.calls[0].extras).toEqual({ kind: 'sticky', padding: 4 });
  });

  it('snaps the center through the snap dep', () => {
    const insert = makeInsertDep();
    const snap: SnapDep = { point: (p) => ({ x: Math.round(p.x / 25) * 25, y: Math.round(p.y / 25) * 25 }) };
    click({ kind: 'sticky', size: { width: 40, height: 20 } }, { insert, snap }, { x: 103, y: 48 });
    expect(insert.calls[0].bounds).toEqual({ x: 80, y: 40, width: 40, height: 20 });
  });

  it('places nothing with no size, which a click cannot draw', () => {
    const insert = makeInsertDep();
    click({ kind: 'rect' }, { insert });
    expect(insert.calls).toEqual([]);
  });

  it('clears the selection, as starting a drawn insert does', () => {
    const insert = makeInsertDep();
    const selection = makeSelection(['a']);
    click({ kind: 'rect', size: { width: 10, height: 10 } }, { insert, selection } as never);
    expect(selection.get()).toEqual([]);
  });

  it('drops into the caret of a kind that carries text', () => {
    const textEdit = makeTextEditDep();
    click({ kind: 'sticky', size: { width: 40, height: 40 } }, { insert: makeInsertDep(), textEdit } as never);
    expect(textEdit.calls).toEqual([{ id: 'new', opts: { caret: 0 } }]);
  });

  it('does not for a kind that carries none', () => {
    const textEdit = makeTextEditDep();
    click({ kind: 'rect', size: { width: 40, height: 40 } }, { insert: makeInsertDep(), textEdit } as never);
    expect(textEdit.calls).toEqual([]);
  });
});

describe('insertAction — sticky', () => {
  it('drops into the caret of a sticky it drew, as it does for text', () => {
    const insert = makeInsertDep();
    const textEdit = makeTextEditDep();
    const ctx: InvocationCtx = {
      world: { x: 0, y: 0 }, screen: { x: 0, y: 0 },
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      deps: { insert, textEdit } as never,
    };
    if (insertAction.invoker?.timing !== 'ongoing') throw new Error('expected an ongoing invoker');
    const handle = insertAction.invoker.start(ctx, { params: { kind: 'sticky' } } as BindingOpts);
    const end: InvocationCtx = { ...ctx, world: { x: 60, y: 40 }, deps: {} };
    handle.onMove?.(end);
    handle.onEnd?.(end, 'commit');
    expect(textEdit.calls).toEqual([{ id: 'new', opts: { caret: 0 } }]);
  });
});
