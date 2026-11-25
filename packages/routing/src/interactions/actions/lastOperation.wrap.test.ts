/** `LastOperationKeeper.wrap` on its own, under a host with one history and no selection. */
import { describe, expect, it } from 'vitest';
import { createHistory, type Op } from '@weasel-js/history';
import { pref } from '@weasel-js/prefs-schema';
import type { Action } from './action';
import type { ImmediateInvoker, InvocationCtx, OngoingInvoker } from './invoker';
import { LastOperationKeeper, type LastOperationHost } from './lastOperation';

const noop: Op = { apply: () => {}, invert: () => noop };

function hostFor(run: (params: Record<string, unknown>) => void): LastOperationHost {
  const history = createHistory();
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
});
