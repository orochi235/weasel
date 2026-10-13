import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createTarget } from './target';
import { useAnimator } from './useAnimator';

/** An animator whose frame requests and `onTick` calls land on one log, in order. */
function setup() {
  const log: string[] = [];
  const cbs: ((t: number) => void)[] = [];
  let now = 0;
  const { result } = renderHook(() => useAnimator({
    now: () => now,
    requestFrame: (cb) => { log.push('request'); cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
  }));
  const animator = result.current;
  animator.onTick(() => { log.push('onTick'); });
  return {
    animator,
    log,
    frame: (ms: number) => act(() => { now += ms; log.length = 0; for (const cb of cbs.splice(0)) cb(now); }),
  };
}

// A canvas asks for its paint from `onTick`. A frame the animator asks for ahead of that runs
// before the paint on the next tick and after it on the one after, and that tick paints nothing.
describe('the frame an animator asks for from inside its own', () => {
  it('comes after onTick when a track takes hold of its target', () => {
    const { animator, log, frame } = setup();
    let v = 0;
    const target = createTarget<number>({ get: () => v, set: (n) => { v = n; } });
    act(() => {
      animator.timeline({ tracks: [{ kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 100, value: 1 }], target }] });
    });
    frame(16);
    expect(log).toEqual(['onTick', 'request']);
  });

  it('comes after onTick when a tick starts another animation', () => {
    const { animator, log, frame } = setup();
    act(() => {
      animator.tween({
        from: 0, to: 1, ms: 10, onTick: () => {},
        onDone: () => { animator.tween({ from: 0, to: 1, ms: 100, onTick: () => {} }); },
      });
    });
    frame(0);
    frame(16);
    expect(log).toEqual(['onTick', 'request']);
  });

  it('still asks for one when a hold is touched between frames', () => {
    const { animator, log, frame } = setup();
    let v = 0;
    const target = createTarget<number>({ get: () => v, set: (n) => { v = n; } });
    let h!: ReturnType<typeof animator.hold>;
    act(() => { h = animator.hold({ target, value: 5 }); });
    frame(16);
    expect(log).toEqual(['onTick']);
    act(() => { h.touch(); });
    expect(log).toEqual(['onTick', 'request']);
  });
});
