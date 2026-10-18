import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { KitSettingsProvider } from '@weasel-js/react';
import { stubReducedMotion } from '@weasel-js/react/testing/stubReducedMotion';
import { useAnimator } from '@weasel-js/animator/react';
import { DEFAULT_VIEW_ANIMATION_MS, useViewAnimation, type ViewChannel } from './useViewAnimation';
import type { View } from './view';

afterEach(() => { vi.unstubAllGlobals(); });

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const AWAY: View = { x: 5, y: 5, scale: { x: 1, y: 1 } };

/** Mount a runner on a hand-driven clock; `run` animates and returns how long it took, in 10ms frames. */
function mount(wrapper?: (props: { children: ReactNode }) => ReactNode) {
  let t = 0;
  let queue: Array<(ts: number) => void> = [];
  const clock = {
    now: () => t,
    requestFrame: (cb: (ts: number) => void) => { queue.push(cb); return queue.length; },
    cancelFrame: () => {},
  };
  let v = HOME;
  const channel: ViewChannel = { get: () => v, set: (next) => { v = next; } };
  const { result } = renderHook(() => useViewAnimation(channel, useAnimator(clock)), wrapper ? { wrapper } : undefined);
  return (ms?: number): number => {
    const done = vi.fn();
    act(() => { result.current.animate(v === HOME ? AWAY : HOME, { onDone: done, ...(ms === undefined ? {} : { ms }) }); });
    let elapsed = 0;
    while (!done.mock.calls.length && elapsed < 5000) {
      act(() => {
        t += 10;
        const due = queue;
        queue = [];
        for (const cb of due) cb(t);
      });
      elapsed += 10;
    }
    return elapsed;
  };
}

describe('useViewAnimation under prefers-reduced-motion', () => {
  it('moves the camera at once in place of the default duration and the view.animationMs setting', () => {
    stubReducedMotion(true);
    expect(mount()()).toBeLessThanOrEqual(10);
    const provided = ({ children }: { children: ReactNode }) =>
      createElement(KitSettingsProvider, { value: { view: { animationMs: 400 } } }, children);
    expect(mount(provided)()).toBeLessThanOrEqual(10);
  });

  it('follows the preference as it changes', () => {
    const set = stubReducedMotion(true);
    const run = mount();
    expect(run()).toBeLessThanOrEqual(10);
    act(() => set(false));
    expect(run()).toBe(DEFAULT_VIEW_ANIMATION_MS);
  });

  it('leaves a duration a call names', () => {
    stubReducedMotion(true);
    expect(mount()(120)).toBe(120);
  });
});
