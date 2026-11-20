import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScene, linear } from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import type { Animator } from '@weasel-js/animator';
import { d3Bind } from './bind';
import { transitionCancelKey } from './cancelKey';

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
  return { clock, bind, x, animator: () => animator.current as Animator, scene: () => scene.current };
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

describe('d3Bind transition — cancel keys', () => {
  it('a transition named `a:b` on node `c` leaves one named `a` on node `b:c` running', () => {
    const s = setup();
    act(() => void s.bind([{ id: 'c', x: 0 }, { id: 'b:c', x: 0 }]));
    act(() => {
      const sel = s.bind([{ id: 'c', x: 100 }, { id: 'b:c', x: 100 }]);
      sel.filter((d) => d.id === 'b:c').transition('a').duration(100).ease(linear).end();
      sel.filter((d) => d.id === 'c').transition('a:b').duration(100).ease(linear).end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(200));
    expect(s.x('b:c')).toBeCloseTo(100, 6);
    expect(s.x('c')).toBeCloseTo(100, 6);
  });

  it('transitionCancelKey names the tween animator.cancelKey stops', () => {
    const s = setup();
    act(() => void s.bind([{ id: 'a', x: 0 }]));
    act(() => void s.bind([{ id: 'a', x: 100 }]).transition('move').duration(100).ease(linear).end());
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(50));
    const mid = s.x('a')!;
    act(() => s.animator().cancelKey(transitionCancelKey(s.scene(), 'move', 'a')));
    act(() => s.clock.advance(100));
    expect(s.x('a')).toBeCloseTo(mid, 6);
  });
});

describe('d3Bind transition — its tweens stopped from outside', () => {
  const run = (s: ReturnType<typeof setup>, configure?: (t: ReturnType<ReturnType<typeof setup>['bind']>) => void) => {
    const seen = { end: 0, interrupt: 0, next: 0 };
    let end!: Promise<void>;
    act(() => void s.bind([{ id: 'a', x: 0 }]));
    act(() => {
      const sel = s.bind([{ id: 'a', x: 100 }]);
      configure?.(sel);
      const t = sel.transition('move').duration(100)
        .on('end', () => { seen.end++; }).on('interrupt', () => { seen.interrupt++; });
      t.transition().on('start', () => { seen.next++; });
      end = t.end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(50));
    return { seen, end: () => end };
  };

  it('animator.cancelKey on its pose tween ends it as an interrupt, and runs nothing chained', async () => {
    const s = setup();
    const r = run(s);
    act(() => s.animator().cancelKey(transitionCancelKey(s.scene(), 'move', 'a')));
    act(() => s.clock.advance(200));
    expect(await settled(r.end())).toBe(true);
    expect(r.seen).toEqual({ end: 0, interrupt: 1, next: 0 });
  });

  it('animator.cancelAll ends it as an interrupt', async () => {
    const s = setup();
    const r = run(s);
    act(() => s.animator().cancelAll());
    expect(await settled(r.end())).toBe(true);
    expect(r.seen.interrupt).toBe(1);
  });

  it('a custom tween whose tick throws ends it as an interrupt', async () => {
    const s = setup();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let end!: Promise<void>;
    const onInterrupt = vi.fn();
    act(() => void s.bind([{ id: 'a', x: 0 }]));
    act(() => {
      end = s.bind([{ id: 'a', x: 100 }]).transition('move').duration(100)
        .tween({ name: 'fill', from: () => 'red', to: () => 'blue', apply: () => {} })
        .on('interrupt', onInterrupt).end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(50));
    expect(await settled(end)).toBe(true);
    expect(onInterrupt).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});

describe('d3Bind transition — two scenes on one animator', () => {
  it('a transition or an interrupt on one scene leaves the other scene’s node of the same id running', async () => {
    const s = setup();
    const other = renderHook(() =>
      useScene<Record<string, unknown>, 'graph', Pose>({ systemLayers: [{ id: 'graph' }], initial: [] }),
    ).result;
    const bindOther = (data: Datum[]) =>
      d3Bind(other.current, data, { key: (d) => d.id, animator: s.animator() })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join();
    act(() => void s.bind([{ id: 'a', x: 0 }]));
    act(() => void bindOther([{ id: 'a', x: 0 }]));
    const onInterrupt = vi.fn();
    let end!: Promise<void>;
    act(() => {
      end = s.bind([{ id: 'a', x: 100 }]).transition().duration(100).ease(linear).on('interrupt', onInterrupt).end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(20));
    act(() => {
      const sel = bindOther([{ id: 'a', x: 100 }]);
      void sel.transition().duration(100).end();
      sel.interrupt();
    });
    act(() => s.clock.advance(100));
    expect(onInterrupt).not.toHaveBeenCalled();
    expect(await settled(end)).toBe(true);
    expect(s.x('a')).toBeCloseTo(100, 6);
  });
});
