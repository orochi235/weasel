/** `LastOperationKeeper.wrap` on its own, under a host with one history and no selection. */
import { describe, expect, it } from 'vitest';
import { createHistory, type Op } from '@weasel-js/history';
import { pref } from '@weasel-js/prefs-schema';
import type { Action } from './action';
import type { ImmediateInvoker, InvocationCtx, OngoingInvoker } from './invoker';
import { LastOperationKeeper, type LastOperationHost } from './lastOperation';

const noop: Op = { apply: () => {}, invert: () => noop };

function hostFor(run: (params: Record<string, unknown>) => void, history = createHistory({})): LastOperationHost {
  return {
    history: () => history,
    takeSelection: () => null,
    paramsOf: (_id, given) => ({ ...given }),
    rerun: (_id, params) => { run(params); history.applyOps([noop], 'run'); return true; },
    admits: () => true,
    keep: () => {},
  };
}

describe('LastOperationKeeper.wrap', () => {
  it("hands on a drag whose handle's onMove passes", () => {
    const host = hostFor(() => {});
    const invoker: OngoingInvoker = {
      timing: 'ongoing',
      start: () => ({ onMove: () => 'pass', onEnd: () => {}, replay: () => {} }),
    };
    const action: Action = { id: 'a', label: 'A', params: pref.group('A', { n: pref.number('N', 1) }), invoker };
    const wrapped = new LastOperationKeeper(() => {}).wrap(action, host).invoker as OngoingInvoker;
    const ctx = { deps: {}, world: { x: 0, y: 0 } } as unknown as InvocationCtx;
    expect(wrapped.start(ctx).onMove?.(ctx)).toBe('pass');
  });

  it('reads and writes a grouped leaf at its path in nested params', () => {
    const history = createHistory({});
    const reruns: Record<string, unknown>[] = [];
    const host = hostFor((p) => reruns.push(p), history);
    const run: ImmediateInvoker['run'] = () => { history.applyOps([noop], 'run'); };
    const form = pref.group('Stroke', { stroke: pref.group('Stroke', { width: pref.number('Width', 1) }) });
    const keeper = new LastOperationKeeper(() => {});
    const wrapped = keeper.wrap({ id: 'a', label: 'A', params: form, invoker: { timing: 'immediate', run } }, host).invoker as ImmediateInvoker;
    wrapped.run({}, { stroke: { width: 4, cap: 'round' }, other: 1 });
    expect(keeper.get()?.values).toEqual({ 'stroke.width': 4 });
    expect(keeper.adjust({ 'stroke.width': 7 })).toBe(true);
    expect(reruns).toEqual([{ stroke: { width: 7, cap: 'round' }, other: 1 }]);
    expect(keeper.sessionTuning('a')?.params).toEqual({ stroke: { width: 7 } });
  });
});
