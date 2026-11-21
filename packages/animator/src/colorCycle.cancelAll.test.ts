import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { cycleVertexColors } from './colorCycle';

function setup() {
  const { result } = renderHook(() => useAnimator({ now: () => 0, requestFrame: () => 1, cancelFrame: () => {} }));
  return result.current;
}

describe('cycleVertexColors and cancelAll', () => {
  it('drops the cycle when the animator cancels everything', () => {
    const animator = setup();
    const handle = cycleVertexColors(animator, { id: 'n', channel: 'fill', msPerCycle: 1000 });
    expect(animator.colorOverrides.get('n', 'fill')).toBeTypeOf('function');
    act(() => { animator.cancelAll(); });
    expect(animator.colorOverrides.get('n', 'fill')).toBeUndefined();
    expect(animator.isActive()).toBe(false);
    animator.colorOverrides.set('n', 'fill', [1, 0, 0, 1]);
    handle.cancel();
    expect(animator.colorOverrides.get('n', 'fill')).toEqual([1, 0, 0, 1]);
  });

  it('hands keepAlive an onCancel that hears both ways of ending', () => {
    const animator = setup();
    const a = vi.fn();
    const release = animator.keepAlive(a);
    release();
    release();
    expect(a).toHaveBeenCalledTimes(1);
    const b = vi.fn();
    animator.keepAlive(b);
    act(() => { animator.cancelAll(); });
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe('cycleVertexColors replaced through the registry', () => {
  it.each([
    ['set over', (a: ReturnType<typeof setup>) => a.colorOverrides.set('n', 'fill', [1, 0, 0, 1])],
    ['cleared', (a: ReturnType<typeof setup>) => a.colorOverrides.clear('n', 'fill')],
    ['cleared with the rest', (a: ReturnType<typeof setup>) => a.colorOverrides.clearAll()],
  ])('lets the frame loop stop once the cycle is %s', (_, replace) => {
    const animator = setup();
    const handle = cycleVertexColors(animator, { id: 'n', channel: 'fill', msPerCycle: 1000 });
    expect(animator.isActive()).toBe(true);
    act(() => { replace(animator); });
    expect(animator.isActive()).toBe(false);
    const after = animator.colorOverrides.get('n', 'fill');
    handle.cancel();
    expect(animator.colorOverrides.get('n', 'fill')).toEqual(after);
  });
});
