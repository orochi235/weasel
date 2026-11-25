import { describe, expect, it, vi } from 'vitest';
import type { Dispatcher } from '../dispatcherApi';
import type { OngoingHandle } from '../../actions/invoker';
import { followPointer, type HeldKey } from './overKeys';

function setup(inFlight: ReadonlyMap<string, OngoingHandle>) {
  const on = { inFlight: () => inFlight } as unknown as Dispatcher;
  const dispatch = vi.fn((): 'handled' | 'unhandled' => 'handled');
  const core = {
    dispatch, dispatcherNow: () => on, routeAt: () => {}, routedView: () => null, setRoutedView: () => {},
  };
  const down = new Map([['Space', { key: ' ', code: 'Space', withCmd: false }]]);
  const held = new Map<string, HeldKey>([['Space', { key: ' ', code: 'Space', withCmd: false, on, view: null }]]);
  const { arrive } = followPointer(core, down, held);
  arrive(new PointerEvent('pointerenter'));
  return dispatch;
}

describe('followPointer', () => {
  it('presses a held key again once something other than its keyup ended its gesture', () => {
    expect(setup(new Map())).toHaveBeenCalledTimes(1);
  });

  it('leaves a held key whose gesture is still in flight', () => {
    expect(setup(new Map([['key-held-Space', {}]]))).not.toHaveBeenCalled();
  });
});
