import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScene, linear } from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import type { Animator } from '@weasel-js/animator';
import { d3Bind } from './bind';

interface Datum {
  id: string;
  x: number;
}
interface Pose {
  x: number;
  y: number;
  width: number;
  height: number;
}

afterEach(() => {
  vi.useRealTimers();
});

function setup() {
  let next = 1;
  const cbs = new Map<number, (t: number) => void>();
  let now = 0;
  const clock = {
    requestFrame: (cb: (t: number) => void): number => {
      const h = next++;
      cbs.set(h, cb);
      return h;
    },
    cancelFrame: (h: number): void => {
      cbs.delete(h);
    },
    advance(deltaMs: number) {
      now += deltaMs;
      const due = Array.from(cbs.entries());
      cbs.clear();
      for (const [, cb] of due) cb(now);
    },
  };
  const scene = renderHook(() =>
    useScene<Record<string, unknown>, 'graph', Pose>({ systemLayers: [{ id: 'graph' }], initial: [] }),
  ).result;
  const animator = renderHook(() => useAnimator(clock)).result;
  const bind = (data: Datum[]) =>
    d3Bind(scene.current, data, { key: (d) => d.id, animator: animator.current as Animator })
      .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
      .join();
  const x = (id: string) => scene.current.get(id as never)?.pose.x;
  return { clock, bind, x };
}

const settled = async (p: Promise<void>): Promise<boolean> => {
  let done = false;
  void p.then(() => { done = true; });
  await Promise.resolve();
  await Promise.resolve();
  return done;
};

describe('d3Bind transition — interrupting one node', () => {
  it('selection.interrupt stops an item still waiting out its delay', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const s = setup();
    act(() => void s.bind([{ id: 'a', x: 0 }]));
    act(() => {
      const sel = s.bind([{ id: 'a', x: 100 }]);
      sel.transition('move').duration(100).ease(linear).delay(500).end();
      sel.interrupt('move');
    });
    act(() => vi.advanceTimersByTime(500));
    act(() => s.clock.advance(100));
    act(() => s.clock.advance(100));
    expect(s.x('a')).toBeCloseTo(0, 6);
  });

  it('selection.interrupt ends the transition, as an interrupt', async () => {
    const s = setup();
    act(() => void s.bind([{ id: 'a', x: 0 }]));
    const onEnd = vi.fn();
    const onInterrupt = vi.fn();
    let end!: Promise<void>;
    act(() => {
      const sel = s.bind([{ id: 'a', x: 100 }]);
      end = sel.transition('move').duration(500).on('end', onEnd).on('interrupt', onInterrupt).end();
      s.clock.advance(100);
      sel.interrupt('move');
    });
    expect(await settled(end)).toBe(true);
    expect(onInterrupt).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('a new transition of the same name on a node interrupts the one it displaces', async () => {
    const s = setup();
    act(() => void s.bind([{ id: 'a', x: 0 }]));
    const onInterrupt = vi.fn();
    let first!: Promise<void>;
    act(() => {
      first = s.bind([{ id: 'a', x: 100 }]).transition().duration(500).on('interrupt', onInterrupt).end();
    });
    act(() => s.clock.advance(100));
    let second!: Promise<void>;
    act(() => {
      second = s.bind([{ id: 'a', x: 200 }]).transition().duration(500).end();
    });
    expect(await settled(first)).toBe(true);
    expect(onInterrupt).toHaveBeenCalledTimes(1);
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(600));
    expect(s.x('a')).toBeCloseTo(200, 6);
    expect(await settled(second)).toBe(true);
  });

  it('a displaced exit transition does not remove its node', () => {
    const s = setup();
    act(() => void s.bind([{ id: 'a', x: 0 }]));
    act(() => {
      s.bind([{ id: 'a', x: 100 }]).transition().duration(500).remove().end();
    });
    act(() => s.clock.advance(100));
    act(() => {
      s.bind([{ id: 'a', x: 200 }]).transition().duration(100).end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(1000));
    expect(s.x('a')).toBeCloseTo(200, 6);
  });
});
