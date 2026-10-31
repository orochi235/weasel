import { describe, expect, it } from 'vitest';
import { act, render } from '@testing-library/react';
import { createHistory, type History, type Op } from '@weasel-js/history';
import { pref } from '@weasel-js/prefs';
import type { Action } from './action';
import { ActionsProvider, useActionsRegistry } from './ActionsProvider';
import { DepRegistryProvider, useDepRegistry, type DepName, type DepRegistry } from './depRegistry';
import { resolveParams, type InvocationCtx, type OngoingHandle } from './invoker';
import type { ActionsRegistry } from './registry';
import { lastOperationOf } from './useLastOperation';

interface Doc { width: number; selected: string[]; ranOn: string[][] }

function setWidth(doc: Doc, to: number): Op {
  const from = doc.width;
  const op = (a: number, b: number): Op => ({ coalesceKey: 'width', apply: () => { doc.width = b; }, invert: () => op(b, a) });
  return op(from, to);
}

const STRETCH_PARAMS = pref.group('Stretch', { factor: pref.number('Factor', 1, { min: 0, max: 10, step: 1 }) });

/** Apply `ops` where a scene would: the open journal, else the history. */
function push(history: History, ops: Op[]): void {
  const journal = history.activeJournal?.();
  if (journal) journal.applyBatch(ops, 'Stretch');
  else history.applyOps(ops, 'Stretch');
}

/** A drag that sets the width to its travel times `factor`, live through coalescing pushes when `live`. */
interface StretchOpts { replays: boolean; live?: boolean; reports?: number; journals?: boolean }

function stretch(doc: Doc, history: History, opts: StretchOpts): Action {
  return {
    id: 'stretch',
    label: 'Stretch',
    params: STRETCH_PARAMS,
    invoker: {
      timing: 'ongoing',
      start(ctx, bindingOpts) {
        const from = ctx.world.x;
        const base = doc.width;
        let travel = 0;
        const factorOf = (p: Record<string, unknown> | undefined) => (typeof p?.factor === 'number' ? p.factor : 1);
        // A gesture that, like one converting text as it begins, journals its edits from the press.
        const own = () => (opts.journals ? history.beginJournal({ label: 'Stretch' }) : null);
        let journal = own();
        const commit = (factor: number) => {
          doc.ranOn.push(doc.selected);
          push(history, [setWidth(doc, base + travel * factor)]);
          journal?.commit('Stretch');
          doc.selected = ['stretched'];
        };
        const handle: OngoingHandle = {
          onMove(m: InvocationCtx) {
            travel = m.world.x - from;
            if (opts.live) push(history, [setWidth(doc, base + travel)]);
          },
          onEnd(_e, reason) {
            if (reason === 'commit' && !opts.live) commit(factorOf(resolveParams(bindingOpts?.params)));
          },
        };
        if (opts.replays) handle.replay = (params) => { journal = own(); commit(factorOf(params)); };
        if (opts.reports !== undefined) handle.params = () => ({ factor: opts.reports });
        return handle;
      },
    },
  };
}

const ctxAt = (x: number): InvocationCtx => ({ world: { x, y: 0 }, modifiers: { shift: false, alt: false, ctrl: false, meta: false }, deps: {} });

function setup(opts: StretchOpts) {
  const doc: Doc = { width: 10, selected: ['a'], ranOn: [] };
  const history = createHistory(doc, { coalesceWindowMs: 1000 });
  let registry: ActionsRegistry | null = null;
  let deps: DepRegistry | null = null;
  function Grab() {
    registry = useActionsRegistry();
    deps = useDepRegistry();
    return null;
  }
  render(<DepRegistryProvider><ActionsProvider><Grab /></ActionsProvider></DepRegistryProvider>);
  act(() => {
    deps!.register('history' as DepName, () => history as never);
    deps!.register('selectionSnapshot', () => ({
      take: () => {
        const was = doc.selected;
        return () => { doc.selected = was; };
      },
    }));
    registry!.register(stretch(doc, history, opts));
  });
  const drag = (to: number, params?: Record<string, unknown>) => {
    const invoker = registry!.list().find((a) => a.id === 'stretch')!.invoker;
    if (invoker?.timing !== 'ongoing') throw new Error('timing');
    act(() => {
      const handle = invoker.start(ctxAt(0), params ? { params } : undefined);
      handle.onMove?.(ctxAt(to / 2));
      handle.onMove?.(ctxAt(to));
      handle.onEnd?.(ctxAt(to), 'commit');
    });
  };
  return { doc, history, registry: registry!, store: lastOperationOf(registry)!, drag };
}

describe('a gesture as the last operation', () => {
  it('holds a drag whose handle replays, at the params it ended with', () => {
    const { store, drag } = setup({ replays: true });
    drag(4, { factor: 2 });
    expect(store.get()).toMatchObject({ id: 'stretch', label: 'Stretch', values: { factor: 2 } });
  });

  it('adjusts by replaying the gesture on the selection it started from, leaving one undo entry', () => {
    const { doc, history, store, drag } = setup({ replays: true });
    drag(4, { factor: 2 });
    expect(doc.width).toBe(18);
    act(() => { expect(store.adjust({ factor: 3 })).toBe(true); });
    expect(doc.width).toBe(22);
    expect(history.undoDepth()).toBe(1);
    expect(store.get()?.values).toEqual({ factor: 3 });
    expect(doc.ranOn).toEqual([['a'], ['a']]);
    act(() => { history.undo(); });
    expect(doc.width).toBe(10);
  });

  it('makes the values used the params the next drag starts from', () => {
    const { doc, registry, store, drag } = setup({ replays: true });
    drag(4);
    act(() => { store.adjust({ factor: 5 }); });
    expect(registry.paramsOf('stretch')).toEqual({ factor: 5 });
    act(() => { store.dismiss(); });
    drag(1);
    expect(doc.width).toBe(35);
  });

  it("shows the params the handle reports it took from what it edited, over the binding's", () => {
    const { store, drag } = setup({ replays: true, reports: 4 });
    drag(4, { factor: 2 });
    expect(store.get()?.values).toEqual({ factor: 4 });
  });

  it('hands a panel change to each tuning that keeps the params, and only a change', () => {
    const { registry, store, drag } = setup({ replays: true });
    const kept: Record<string, unknown>[] = [];
    act(() => { registry.tune('stretch', { keep: (p) => { kept.push({ ...p }); } }); });
    drag(4, { factor: 2 });
    expect(kept).toEqual([]);
    act(() => { store.adjust({ factor: 3 }); });
    expect(kept).toEqual([{ factor: 3 }]);
  });

  it('holds nothing for a drag whose handle cannot replay', () => {
    const { store, drag } = setup({ replays: false });
    drag(4);
    expect(store.get()).toBeNull();
  });

  it('holds nothing for a cancelled drag', () => {
    const { registry, store } = setup({ replays: true });
    const invoker = registry.list().find((a) => a.id === 'stretch')!.invoker;
    if (invoker?.timing !== 'ongoing') throw new Error('timing');
    act(() => {
      const handle = invoker.start(ctxAt(0));
      handle.onMove?.(ctxAt(3));
      handle.onEnd?.(ctxAt(3), 'cancel');
    });
    expect(store.get()).toBeNull();
  });

  it('counts a drag that committed live, coalescing into one entry, as one entry', () => {
    const { history, store, drag } = setup({ replays: true, live: true });
    drag(4);
    expect(history.undoDepth()).toBe(1);
    expect(store.get()).not.toBeNull();
  });
});

describe('the last operation inside a journal', () => {
  it('holds a run made in the open journal, adjusts it there, and ends when the journal commits', () => {
    const { doc, history, store, drag } = setup({ replays: true });
    const journal = history.beginJournal({ label: 'Edit' });
    drag(4, { factor: 2 });
    expect(store.get()).not.toBeNull();
    act(() => { store.adjust({ factor: 3 }); });
    expect(doc.width).toBe(22);
    expect(journal.entries().undo).toHaveLength(1);
    expect(history.undoDepth()).toBe(0);
    act(() => { journal.commit('Edit'); });
    expect(store.get()).toBeNull();
    expect(history.undoDepth()).toBe(1);
  });

  it('holds a gesture that opens its own journal at the press, as the one entry that journal lands', () => {
    const { doc, history, store, drag } = setup({ replays: true, journals: true });
    drag(4, { factor: 2 });
    expect(store.get()).not.toBeNull();
    act(() => { store.adjust({ factor: 3 }); });
    expect(doc.width).toBe(22);
    expect(history.undoDepth()).toBe(1);
  });

  it('ends when the journal is suspended', () => {
    const { history, store, drag } = setup({ replays: true });
    const journal = history.beginJournal({ label: 'Edit' });
    drag(4);
    act(() => { journal.suspend(); });
    expect(store.adjust({ factor: 3 })).toBe(false);
    expect(store.get()).toBeNull();
  });
});
