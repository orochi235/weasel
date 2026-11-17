import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { staggerVertexColors } from './colorHelpers';

function setup() {
  let now = 0;
  const cbs: ((t: number) => void)[] = [];
  const { result } = renderHook(() => useAnimator({
    now: () => now,
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
  }));
  const advance = (ms: number): void => act(() => { now += ms; for (const cb of cbs.splice(0)) cb(now); });
  return { animator: result.current, advance, now: () => now };
}

const from = [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1];
const to = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];

describe('staggerVertexColors', () => {
  it('steps each anchor in turn when anchorMs is 0, painting no NaN', () => {
    const { animator, advance, now } = setup();
    act(() => { staggerVertexColors(animator, { id: 'n', channel: 'fill', from, to, anchorMs: 0, perAnchorDelay: 30, easing: (t) => t }); });
    const shown = (): readonly number[] => {
      const o = animator.colorOverrides.get('n', 'fill');
      return (typeof o === 'function' ? o(from, now()) : o)!;
    };
    advance(0);
    expect(shown().some(Number.isNaN)).toBe(false);
    expect(shown().slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(shown().slice(4, 8)).toEqual([0, 0, 0, 1]);
    advance(30);
    expect(shown().slice(4, 8)).toEqual([1, 1, 1, 1]);
    expect(shown().slice(8, 12)).toEqual([0, 0, 0, 1]);
  });

  it.each([
    ['anchorMs', { anchorMs: NaN, perAnchorDelay: 10 }],
    ['anchorMs', { anchorMs: -1, perAnchorDelay: 10 }],
    ['anchorMs', { anchorMs: Infinity, perAnchorDelay: 10 }],
    ['perAnchorDelay', { anchorMs: 10, perAnchorDelay: -5 }],
    ['perAnchorDelay', { anchorMs: 10, perAnchorDelay: NaN }],
    ['origin', { anchorMs: 10, perAnchorDelay: 10, origin: NaN }],
  ])('refuses a bad %s', (name, times) => {
    const { animator } = setup();
    const start = () => staggerVertexColors(animator, { id: 'n', channel: 'fill', from, to, ...times });
    expect(start).toThrow(RangeError);
    expect(start).toThrow(name);
    expect(animator.isActive()).toBe(false);
  });
});
