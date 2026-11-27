import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewAnimation, type ViewChannel } from './useViewAnimation';
import { useAnimator } from '@weasel-js/animator/react';
import { linear } from '@weasel-js/geom';
import type { View } from './view';

function makeClock() {
  let t = 0;
  let queue: Array<(ts: number) => void> = [];
  return {
    now: () => t,
    requestFrame: (cb: (ts: number) => void) => { queue.push(cb); return queue.length; },
    cancelFrame: () => {},
    advance(ms: number) {
      t += ms;
      const due = queue;
      queue = [];
      for (const cb of due) cb(t);
    },
  };
}

function makeChannel(initial: View) {
  let v = initial;
  const channel: ViewChannel = { get: () => v, set: (next) => { v = next; } };
  return { channel, current: () => v };
}

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const RIGHT: View = { x: 100, y: 0, scale: { x: 1, y: 1 } };

describe('useViewAnimation lifecycle', () => {
  it('animateToBounds into a viewport with no area stops the move in flight before calling onDone', () => {
    const clock = makeClock();
    const { channel, current } = makeChannel(HOME);
    const { result } = renderHook(() => useViewAnimation(channel, useAnimator(clock)));
    act(() => { result.current.animate(RIGHT, { ms: 200, easing: linear }); });
    act(() => { clock.advance(100); });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onDone = vi.fn(() => { expect(result.current.isAnimating()).toBe(false); });
    act(() => { result.current.animateToBounds({ x: 0, y: 0, width: 10, height: 10 }, { width: 0, height: 300 }, { onDone }); });
    warn.mockRestore();
    expect(onDone).toHaveBeenCalledTimes(1);
    const at = current().x;
    act(() => { clock.advance(100); });
    expect(current().x).toBe(at);
  });
});
