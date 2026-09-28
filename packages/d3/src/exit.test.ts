import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator, useScene, linear } from '@weasel-js/core';
import type { Animator } from '@weasel-js/core';
import { d3Bind } from './bind';
import type { D3Selection, D3Transition } from './types';

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

function makeClock() {
  let next = 1;
  const cbs = new Map<number, (t: number) => void>();
  let now = 0;
  return {
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
}

function setup() {
  const clock = makeClock();
  const scene = renderHook(() =>
    useScene<Record<string, unknown>, 'graph', Pose>({
      systemLayers: [{ id: 'graph' }],
      initial: [],
    }),
  ).result;
  const animator = renderHook(() => useAnimator(clock)).result;
  const bind = (
    data: Datum[],
    exit?: (sel: D3Selection<Record<string, unknown>, Pose>) => void,
  ) => {
    const b = d3Bind(scene.current, data, {
      key: (d) => d.id,
      animator: animator.current as Animator,
    }).pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }));
    if (exit) b.exit(exit);
    return b.join();
  };
  return { scene, clock, bind };
}

const slideOut = (sel: D3Selection<Record<string, unknown>, Pose>) =>
  sel
    .transition()
    .duration(1000)
    .ease(linear)
    .pose(() => ({ x: -100, y: 0, width: 10, height: 10 }))
    .remove();

describe('d3Bind exit transitions', () => {
  it('keeps the exiting node until its transition ends, then removes it', () => {
    const { scene, clock, bind } = setup();
    act(() => void bind([{ id: 'a', x: 0 }, { id: 'b', x: 10 }]));
    act(() => void bind([{ id: 'b', x: 10 }], (exit) => void slideOut(exit).end()));

    expect(scene.current.get('a' as never)).toBeDefined();
    act(() => clock.advance(0));
    act(() => clock.advance(500));
    expect(scene.current.get('a' as never)?.pose.x).toBeCloseTo(-50, 1);
    act(() => clock.advance(600));
    expect(scene.current.get('a' as never)).toBeUndefined();
    expect(scene.current.get('b' as never)).toBeDefined();

    act(() => scene.current.undo());
    expect(scene.current.get('a' as never)).toBeDefined();
  });

  it('removes the node at the end of the last transition in a chain', () => {
    const { scene, clock, bind } = setup();
    act(() => void bind([{ id: 'a', x: 0 }]));
    act(() => void bind([], (exit) => {
      exit
        .transition()
        .duration(500)
        .transition()
        .pose(() => ({ x: 50, y: 0, width: 10, height: 10 }))
        .remove()
        .end();
    }));
    act(() => clock.advance(0));
    act(() => clock.advance(600));
    expect(scene.current.get('a' as never)).toBeDefined();
    act(() => clock.advance(0));
    act(() => clock.advance(600));
    expect(scene.current.get('a' as never)).toBeUndefined();
  });

  it('does not remove a node whose exit transition is interrupted', async () => {
    const { scene, clock, bind } = setup();
    act(() => void bind([{ id: 'a', x: 0 }]));
    let t!: D3Transition<Record<string, unknown>, Pose>;
    let ended!: Promise<void>;
    act(() => void bind([], (exit) => {
      t = slideOut(exit);
      ended = t.end();
    }));
    act(() => clock.advance(0));
    act(() => clock.advance(300));
    act(() => t.interrupt());
    act(() => clock.advance(2000));
    await ended;
    expect(scene.current.get('a' as never)).toBeDefined();
  });

  it('keeps and rebinds a node whose key re-enters before its exit ends', () => {
    const { scene, clock, bind } = setup();
    act(() => void bind([{ id: 'a', x: 0 }, { id: 'b', x: 10 }]));
    const onEnd = vi.fn();
    act(() => void bind([], (exit) => void slideOut(exit).on('end', onEnd).end()));
    act(() => clock.advance(0));
    act(() => clock.advance(500));

    let sel!: D3Selection<Datum, Pose>;
    act(() => {
      sel = bind([{ id: 'a', x: 42 }]);
    });
    expect(sel.ids).toEqual(['a']);
    act(() => clock.advance(1000));
    act(() => clock.advance(1000));

    expect(scene.current.get('a' as never)?.pose.x).toBe(42);
    expect(scene.current.get('b' as never)).toBeUndefined();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('removes exiting nodes at once when no exit handler is given', () => {
    const { scene, bind } = setup();
    act(() => void bind([{ id: 'a', x: 0 }]));
    act(() => void bind([]));
    expect(scene.current.get('a' as never)).toBeUndefined();
  });

  it('hands the handler the exiting nodes with their scene data', () => {
    const { bind } = setup();
    act(() => void bind([{ id: 'a', x: 0 }, { id: 'b', x: 1 }]));
    const seen: string[] = [];
    act(() => void bind([{ id: 'b', x: 1 }], (exit) => {
      exit.each((_, id) => seen.push(id));
    }));
    expect(seen).toEqual(['a']);
  });

  it('spares a same-id node that replaced the exiting one between two frames', async () => {
    const { scene, clock, bind } = setup();
    act(() => void bind([{ id: 'a', x: 0 }]));
    let ended!: Promise<void>;
    act(() => void bind([], (exit) => {
      ended = slideOut(exit).end();
    }));
    act(() => clock.advance(0));
    act(() => clock.advance(300));
    act(() => {
      scene.current.remove('a' as never);
      scene.current.add({
        id: 'a' as never,
        kind: 'leaf',
        layer: 'graph',
        pose: { x: 7, y: 0, width: 10, height: 10 },
        data: {},
      });
    });
    act(() => clock.advance(2000));
    await ended;
    expect(scene.current.get('a' as never)?.pose.x).toBe(7);
  });

  it('stops tweening a node removed externally, and spares a same-id node added afterward', async () => {
    const { scene, clock, bind } = setup();
    act(() => void bind([{ id: 'a', x: 0 }]));
    const onEnd = vi.fn();
    let ended!: Promise<void>;
    act(() => void bind([], (exit) => {
      ended = slideOut(exit).on('end', onEnd).end();
    }));
    act(() => clock.advance(0));
    act(() => clock.advance(300));
    act(() => scene.current.remove('a' as never));
    expect(() => act(() => clock.advance(100))).not.toThrow();
    act(() => void scene.current.add({
      id: 'a' as never,
      kind: 'leaf',
      layer: 'graph',
      pose: { x: 7, y: 0, width: 10, height: 10 },
      data: {},
    }));
    act(() => clock.advance(2000));
    await ended;
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(scene.current.get('a' as never)?.pose.x).toBe(7);
  });
});
