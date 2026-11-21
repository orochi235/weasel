import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createTarget, type TargetAxes } from './target';
import { useAnimator } from './useAnimator';

function mountAnimator() {
  let now = 0;
  const frameCbs: ((t: number) => void)[] = [];
  const { result } = renderHook(() => useAnimator({
    now: () => now,
    requestFrame: (cb) => { frameCbs.push(cb); return frameCbs.length; },
    cancelFrame: () => {},
  }));
  const advance = (ms: number): void => {
    now += ms;
    for (const cb of frameCbs.splice(0)) cb(now);
  };
  return { animator: result.current, advance };
}

function listAxes(count: number, add: TargetAxes<number[]>['add']): TargetAxes<number[]> {
  return { count, to: (v) => v.slice(), from: (a) => Array.from(a), add };
}

const linear = (t: number) => t;

describe("a custom axes.add's delta", () => {
  it('is exactly as long as the target has axes, after a wider target is read', () => {
    const { animator, advance } = mountAnimator();
    let wide = new Array<number>(16).fill(0);
    const wideTarget = createTarget({ get: () => wide, set: (v) => { wide = v; }, axes: listAxes(16, (v, d) => v.map((x, i) => x + d[i]!)) });
    let pair = [0, 0];
    const pairTarget = createTarget({ get: () => pair, set: (v) => { pair = v; }, axes: listAxes(2, (v, d) => Array.from(d, (x, i) => (v[i] ?? 0) + x)) });
    act(() => {
      animator.tween({ target: wideTarget, to: new Array<number>(16).fill(10), ms: 100, easing: linear });
      animator.tween({ target: pairTarget, to: [10, 10], ms: 100, easing: linear });
    });
    act(() => { advance(50); });
    wideTarget.read();
    expect(pairTarget.read()).toHaveLength(2);
  });

  it('is its own while the add reads another target', () => {
    const { animator, advance } = mountAnimator();
    let other = [0];
    const otherTarget = createTarget({ get: () => other, set: (v) => { other = v; }, axes: listAxes(1, (v, d) => [v[0]! + d[0]!]) });
    let mine = [0];
    const mineTarget = createTarget({
      get: () => mine, set: (v) => { mine = v; },
      axes: listAxes(1, (v, d) => { otherTarget.read(); return [v[0]! + d[0]!]; }),
    });
    act(() => {
      animator.tween({ target: otherTarget, to: [100], ms: 100, easing: linear });
      animator.tween({ target: mineTarget, to: [10], ms: 100, easing: linear });
    });
    act(() => { advance(50); });
    expect(mineTarget.read()[0]).toBeCloseTo(5);
  });
});
