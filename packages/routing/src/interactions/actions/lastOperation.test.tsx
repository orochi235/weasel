import { describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { createHistory, type History, type Op } from '@weasel-js/history';
import { pref } from '@weasel-js/prefs';
import type { Action } from './action';
import { ActionsProvider, useActionsRegistry } from './ActionsProvider';
import { DepRegistryProvider, useDepRegistry, type DepName, type DepRegistry } from './depRegistry';
import type { ActionsRegistry } from './registry';
import { lastOperationOf } from './useLastOperation';

/** The document the test action edits: a width, the selection, and the selection each run started from. */
interface Doc { width: number; selected: string[]; ranOn: string[][] }

function setWidth(doc: Doc, to: number): Op {
  const from = doc.width;
  const op = (a: number, b: number): Op => ({ apply: () => { doc.width = b; }, invert: () => op(b, a) });
  return op(from, to);
}

const WIDEN_PARAMS = pref.group('Widen', { by: pref.number('By', 1, { min: 0, max: 10, step: 1 }) });

function widen(doc: Doc, history: History): Action {
  return {
    id: 'widen',
    label: 'Widen',
    params: WIDEN_PARAMS,
    invoker: {
      timing: 'immediate',
      run: (_deps, params) => {
        const by = typeof params?.by === 'number' ? params.by : 1;
        doc.ranOn.push(doc.selected);
        if (by === 0) return;
        history.applyOps([setWidth(doc, doc.width + by)], 'Widen');
        doc.selected = ['result'];
      },
    },
  };
}

function setup() {
  const doc: Doc = { width: 10, selected: ['a', 'b'], ranOn: [] };
  const history = createHistory(doc);
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
    registry!.register(widen(doc, history));
  });
  const store = lastOperationOf(registry)!;
  return { doc, history, registry: registry!, store };
}

describe('the last operation', () => {
  it('holds a run of an action with params that committed one entry, at the values it used', () => {
    const { registry, store } = setup();
    expect(store.get()).toBeNull();
    act(() => { registry.trigger('widen', { by: 3 }); });
    expect(store.get()).toMatchObject({ id: 'widen', label: 'Widen', schema: WIDEN_PARAMS, values: { by: 3 } });
  });

  it('holds a run the dispatcher makes, through the listed action', () => {
    const { registry, store } = setup();
    const invoker = registry.list().find((a) => a.id === 'widen')!.invoker;
    if (invoker?.timing !== 'immediate') throw new Error('timing');
    act(() => { invoker.run({}, { by: 2, world: { x: 1, y: 1 } }); });
    expect(store.get()?.values).toEqual({ by: 2 });
  });

  it('fills a param the run was not given from its default', () => {
    const { registry, store } = setup();
    act(() => { registry.trigger('widen'); });
    expect(store.get()?.values).toEqual({ by: 1 });
  });

  it('holds nothing for a run that committed no entry', () => {
    const { registry, store } = setup();
    act(() => { registry.trigger('widen', { by: 0 }); });
    expect(store.get()).toBeNull();
  });

  it('adjusts in place, leaving one undo entry, rerun on the selection it started from', () => {
    const { doc, history, registry, store } = setup();
    act(() => { registry.trigger('widen', { by: 3 }); });
    expect(doc.width).toBe(13);
    expect(doc.selected).toEqual(['result']);
    act(() => { expect(store.adjust({ by: 5 })).toBe(true); });
    expect(doc.width).toBe(15);
    expect(history.undoDepth()).toBe(1);
    expect(history.redoDepth()).toBe(0);
    expect(store.get()?.values).toEqual({ by: 5 });
    act(() => { store.adjust({ by: 2 }); });
    expect(doc.width).toBe(12);
    expect(history.undoDepth()).toBe(1);
    expect(doc.ranOn).toEqual([['a', 'b'], ['a', 'b'], ['a', 'b']]);
    expect(store.get()).not.toBeNull();
    act(() => { history.undo(); });
    expect(doc.width).toBe(10);
    expect(history.undoDepth()).toBe(0);
  });

  it('keeps the operation through an adjustment that commits nothing, and the next one reruns it', () => {
    const { doc, history, registry, store } = setup();
    act(() => { registry.trigger('widen', { by: 3 }); });
    act(() => { store.adjust({ by: 0 }); });
    expect(doc.width).toBe(10);
    expect(history.undoDepth()).toBe(0);
    expect(store.get()?.values).toEqual({ by: 0 });
    act(() => { store.adjust({ by: 4 }); });
    expect(doc.width).toBe(14);
    expect(history.undoDepth()).toBe(1);
  });

  it('makes the values used the action\'s params for its next run', () => {
    const { doc, registry, store } = setup();
    act(() => { registry.trigger('widen', { by: 3 }); });
    act(() => { store.adjust({ by: 4 }); });
    act(() => { store.dismiss(); });
    act(() => { registry.trigger('widen'); });
    expect(doc.width).toBe(18);
    expect(registry.paramsOf('widen')).toEqual({ by: 4 });
  });

  it('lets a tuning win over the session params', () => {
    const { registry } = setup();
    act(() => { registry.trigger('widen', { by: 3 }); });
    act(() => { registry.tune('widen', { params: { by: 7 } }); });
    expect(registry.paramsOf('widen')).toEqual({ by: 7 });
  });

  it.each([
    ['another entry', (h: History, doc: Doc) => h.applyOps([setWidth(doc, 99)], 'Other')],
    ['an undo', (h: History) => h.undo()],
  ])('clears on %s', (_, step) => {
    const { doc, history, registry, store } = setup();
    act(() => { registry.trigger('widen', { by: 3 }); });
    act(() => { step(history, doc); });
    expect(store.get()).toBeNull();
    expect(store.adjust({ by: 1 })).toBe(false);
  });

  it('clears on a redo', () => {
    const { history, registry, store } = setup();
    act(() => { registry.trigger('widen', { by: 3 }); });
    act(() => { history.undo(); });
    act(() => { registry.trigger('widen', { by: 2 }); });
    act(() => { history.undo(); history.redo(); });
    expect(store.get()).toBeNull();
  });

  it('takes the form a function answers for the run, and holds nothing for a run it answers none for', () => {
    const { doc, history, registry, store } = setup();
    const byKind: Action = {
      ...widen(doc, history),
      id: 'widenBy',
      params: (p) => (p.kind === 'shown' ? WIDEN_PARAMS : null),
    };
    act(() => { registry.register(byKind); });
    act(() => { registry.trigger('widenBy', { kind: 'hidden', by: 2 }); });
    expect(store.get()).toBeNull();
    act(() => { registry.trigger('widenBy', { kind: 'shown', by: 2 }); });
    expect(store.get()).toMatchObject({ id: 'widenBy', schema: WIDEN_PARAMS, values: { by: 2 } });
    act(() => { store.adjust({ by: 4 }); });
    expect(doc.width).toBe(16);
  });

  it('clears on dismiss and tells its listeners', () => {
    const { registry, store } = setup();
    const heard = vi.fn();
    store.subscribe(heard);
    act(() => { registry.trigger('widen', { by: 3 }); });
    act(() => { store.dismiss(); });
    expect(store.get()).toBeNull();
    expect(heard).toHaveBeenCalledTimes(2);
  });
});
