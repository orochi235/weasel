import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { cycleVertexColors } from './colorCycle';
import type { ColorOverrideFn } from './colorRegistry';

function cycleAt(direction: 1 | -1, tMs: number): number[] {
  const { result } = renderHook(() => useAnimator({ now: () => 0, requestFrame: () => 1, cancelFrame: () => {} }));
  const animator = result.current;
  const handle = cycleVertexColors(animator, { id: 'n', channel: 'fill', msPerCycle: 1000, direction, easing: (t) => t * t });
  const fn = animator.colorOverrides.get('n', 'fill') as ColorOverrideFn;
  // Four anchors whose red channel is their index, so the red of the first says how far they turned.
  const out = fn([0, 0, 0, 1, 1, 0, 0, 1, 2, 0, 0, 1, 3, 0, 0, 1], tMs);
  act(() => { handle.cancel(); });
  return out;
}

describe('cycleVertexColors direction', () => {
  it('eases a backward cycle the same way as a forward one', () => {
    // A quarter of the way in, t * t has turned the colors a sixteenth of the cycle: a quarter anchor.
    expect(cycleAt(1, 250)[0]).toBeCloseTo(0.25);
    // Backward, the first anchor shows a quarter of the way from the last anchor (3) back to it.
    expect(cycleAt(-1, 250)[0]).toBeCloseTo(3 + 0.75 * (0 - 3));
  });
});
