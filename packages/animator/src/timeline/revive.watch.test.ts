import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from '../useAnimator';
import { createTarget } from '../target';
import type { AnimatorEvent } from '../types';

function setup() {
  const cbs: ((t: number) => void)[] = [];
  let clock = 0;
  const { result } = renderHook(() => useAnimator({
    requestFrame: (cb) => { cbs.push(cb); return cbs.length; },
    cancelFrame: () => {},
    now: () => clock,
  }));
  const frame = (t: number) => act(() => { clock = t; for (const cb of cbs.splice(0)) cb(t); });
  return { animator: result.current, frame };
}

describe('a timeline revived after it finished', () => {
  it('reports its second end to watchers', () => {
    const { animator, frame } = setup();
    const seen: string[] = [];
    animator.watch((e: AnimatorEvent) => { if (e.animation.kind === 'timeline') seen.push(e.type); });
    let h!: ReturnType<typeof animator.timeline>;
    act(() => { h = animator.timeline({ tracks: [{ kind: 'sampled', keys: [{ t: 0, value: 0 }, { t: 100, value: 1 }], onTick: () => {} }] }); });
    frame(0); frame(50); frame(200);
    act(() => { h.seek(0); });
    frame(210); frame(260); frame(400);
    expect(seen.filter((t) => t === 'end')).toHaveLength(2);
  });

  it('lets go of its targets when a tick throws after it was revived', () => {
    const { animator, frame } = setup();
    let committed = 0;
    const target = createTarget<number>({ get: () => committed, set: (v) => { committed = v; }, show: () => {} });
    let boom = false;
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    let h!: ReturnType<typeof animator.timeline>;
    act(() => {
      h = animator.timeline({ tracks: [{
        kind: 'sampled', target, keys: [{ t: 0, value: 0 }, { t: 100, value: 10 }],
        onTick: () => { if (boom) throw new Error('boom'); },
      }] });
    });
    frame(0); frame(50); frame(200);
    act(() => { h.seek(0); });
    frame(210); frame(240);
    boom = true;
    frame(250);
    err.mockRestore();
    // Canceled, so its hold let go and committed what the target showed.
    expect(committed).toBeLessThan(10);
  });
});
