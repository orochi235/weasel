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
  const binding = (data: Datum[]) =>
    d3Bind(scene.current, data, { key: (d) => d.id, animator: animator.current as Animator })
      .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }));
  const bind = (data: Datum[]) => binding(data).join();
  const x = (id: string) => scene.current.get(id as never)?.pose.x;
  /** Runs frames of `ms` each until `total` has passed. */
  const play = (total: number, ms = 50) => {
    act(() => clock.advance(0));
    for (let t = 0; t < total; t += ms) act(() => clock.advance(ms));
  };
  return { clock, scene, binding, bind, x, play, animator: () => animator.current as Animator };
}

const settled = async (p: Promise<void>): Promise<boolean> => {
  let done = false;
  void p.then(() => { done = true; });
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  return done;
};

describe('d3Bind transition — custom tweens by name', () => {
  it('a second .tween() of the same name replaces the first, and the transition ends', async () => {
    const s = setup();
    act(() => void s.bind([{ id: 'a', x: 0 }]));
    const first = vi.fn();
    const second: number[] = [];
    let end!: Promise<void>;
    act(() => {
      end = s.bind([{ id: 'a', x: 0 }]).transition().duration(100).ease(linear)
        .tween({ name: 'o', from: () => 0, to: () => 1, apply: first })
        .tween({ name: 'o', from: () => 0, to: () => 2, apply: (_d, _id, v) => second.push(v) })
        .end();
    });
    s.play(200);
    expect(await settled(end)).toBe(true);
    expect(first).not.toHaveBeenCalled();
    expect(second.at(-1)).toBe(2);
  });
});

describe('d3Bind transition — an item interrupted on its node', () => {
  const two = (s: ReturnType<typeof setup>) => {
    act(() => void s.bind([{ id: 'a', x: 0 }, { id: 'b', x: 0 }]));
    return s.bind([{ id: 'a', x: 100 }, { id: 'b', x: 100 }]);
  };

  it('is not removed by a .remove() called after the interrupt', () => {
    const s = setup();
    act(() => {
      const sel = two(s);
      const t = sel.transition().duration(1000);
      void t.end();
      void sel.filter((d) => d.id === 'a').transition().duration(100).end();
      t.remove();
    });
    s.play(1200, 100);
    expect(s.scene.current.get('a' as never)).toBeDefined();
    expect(s.scene.current.get('b' as never)).toBeUndefined();
  });

  it('starts no transition chained after the interrupt, which would interrupt the newer one', async () => {
    const s = setup();
    act(() => {
      const sel = two(s);
      const t = sel.transition().duration(1000);
      void t.end();
      void sel.filter((d) => d.id === 'a').transition().duration(100).ease(linear)
        .pose(() => ({ x: 500, y: 0, width: 10, height: 10 })).end();
      t.transition().pose(() => ({ x: -100, y: 0, width: 10, height: 10 }));
    });
    await Promise.resolve();
    s.play(2500, 100);
    expect(s.x('a')).toBeCloseTo(500, 6);
    expect(s.x('b')).toBeCloseTo(-100, 6);
  });

  it('starts no chained item already queued behind a finished one when it is interrupted', async () => {
    const s = setup();
    let chained!: () => void;
    act(() => {
      const sel = two(s);
      const t = sel.transition().duration(100).delay((_d, i) => i * 1000);
      void t.end();
      chained = () => {
        t.transition().pose(() => ({ x: -100, y: 0, width: 10, height: 10 }));
        void sel.filter((d) => d.id === 'a').transition().duration(100).ease(linear)
          .pose(() => ({ x: 500, y: 0, width: 10, height: 10 })).end();
      };
    });
    s.play(200);
    act(() => chained());
    await Promise.resolve();
    s.play(200);
    expect(s.x('a')).toBeCloseTo(500, 6);
  });
});
