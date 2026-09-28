import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator, useScene, linear } from '@weasel-js/core';
import type { Animator } from '@weasel-js/core';
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

function makeClock() {
  let next = 1;
  const cbs = new Map<number, (t: number) => void>();
  let now = 0;
  return {
    now: () => now,
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

function setupSceneAndAnimator() {
  const clock = makeClock();
  const sceneHook = renderHook(() =>
    useScene<Record<string, unknown>, 'graph', Pose>({
      systemLayers: [{ id: 'graph' }],
      initial: [],
    }),
  );
  const animatorHook = renderHook(() => useAnimator(clock));
  return {
    scene: sceneHook.result,
    animator: animatorHook.result,
    clock,
  };
}

describe('d3Bind transition — pose interpolation', () => {
  it('interpolates pose from prior to new over the duration', () => {
    const { scene, animator, clock } = setupSceneAndAnimator();
    // First join: place node at x=0
    act(() => {
      d3Bind(scene.current, [{ id: 'a', x: 0 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join();
    });
    // Second join: move to x=100, with a transition
    act(() => {
      d3Bind(scene.current, [{ id: 'a', x: 100 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join()
        .transition()
        .duration(1000)
        .ease(linear)
        .end();
    });
    // After join, scene pose is the TARGET (x=100) but the transition will overwrite each frame.
    act(() => clock.advance(0));        // first tween tick at t=0 → write back x=0
    expect(scene.current.get('a' as never)?.pose.x).toBeCloseTo(0, 6);
    act(() => clock.advance(500));      // halfway → x=50
    expect(scene.current.get('a' as never)?.pose.x).toBeCloseTo(50, 4);
    act(() => clock.advance(500));      // settled → x=100
    expect(scene.current.get('a' as never)?.pose.x).toBeCloseTo(100, 6);
  });

  it('uses enterFrom() as the from-pose for entering nodes', () => {
    const { scene, animator, clock } = setupSceneAndAnimator();
    act(() => {
      d3Bind(scene.current, [{ id: 'a', x: 50 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .enterFrom(() => ({ x: 0, y: 0, width: 0, height: 0 }))
        .join()
        .transition()
        .duration(1000)
        .ease(linear)
        .end();
    });
    act(() => clock.advance(0));
    // Entering pose snapshot is (0,0,0,0) — first tick writes that back.
    expect(scene.current.get('a' as never)?.pose).toMatchObject({ x: 0, width: 0 });
    act(() => clock.advance(1000));
    expect(scene.current.get('a' as never)?.pose).toMatchObject({ x: 50, width: 10 });
  });
});

describe('d3Bind transition — chain semantics', () => {
  it('end() Promise resolves after all tweens complete', async () => {
    const { scene, animator, clock } = setupSceneAndAnimator();
    act(() => {
      d3Bind(scene.current, [{ id: 'a', x: 0 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join();
    });
    let endResolved = false;
    let endPromise!: Promise<void>;
    act(() => {
      endPromise = d3Bind(scene.current, [{ id: 'a', x: 100 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join()
        .transition()
        .duration(500)
        .end();
      endPromise.then(() => {
        endResolved = true;
      });
    });
    act(() => clock.advance(0));
    expect(endResolved).toBe(false);
    act(() => clock.advance(500));
    await endPromise;
    expect(endResolved).toBe(true);
  });

  it('on("start") fires once when tweens spawn; on("end") fires once when settled', async () => {
    const { scene, animator, clock } = setupSceneAndAnimator();
    act(() => {
      d3Bind(scene.current, [{ id: 'a', x: 0 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join();
    });
    const onStart = vi.fn();
    const onEnd = vi.fn();
    let endPromise!: Promise<void>;
    act(() => {
      endPromise = d3Bind(scene.current, [{ id: 'a', x: 100 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join()
        .transition()
        .duration(500)
        .on('start', onStart)
        .on('end', onEnd)
        .end();
    });
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    act(() => clock.advance(500));
    await endPromise;
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('interrupt cancels in-flight tweens and fires on("interrupt")', async () => {
    const { scene, animator, clock } = setupSceneAndAnimator();
    act(() => {
      d3Bind(scene.current, [{ id: 'a', x: 0 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join();
    });
    const onInterrupt = vi.fn();
    const onEnd = vi.fn();
    let trans!: ReturnType<ReturnType<ReturnType<typeof d3Bind>['join']>['transition']>;
    let endPromise!: Promise<void>;
    act(() => {
      const sel = d3Bind(scene.current, [{ id: 'a', x: 100 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join();
      trans = sel.transition()
        .duration(500)
        .on('interrupt', onInterrupt)
        .on('end', onEnd);
      endPromise = trans.end();
    });
    act(() => clock.advance(100));     // partway
    act(() => trans.interrupt());
    expect(onInterrupt).toHaveBeenCalledTimes(1);
    expect(onEnd).not.toHaveBeenCalled();
    // end() resolves even on interrupt — the consumer awaits something.
    await endPromise;
  });

  it('selection.interrupt(name) cancels via cancelKey namespace', async () => {
    const { scene, animator, clock } = setupSceneAndAnimator();
    act(() => {
      d3Bind(scene.current, [{ id: 'a', x: 0 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join();
    });
    act(() => {
      const sel = d3Bind(scene.current, [{ id: 'a', x: 100 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join();
      sel.transition('move').duration(500).end();
      act(() => clock.advance(100));
      sel.interrupt('move');
    });
    // Tween should no longer write; advance further and confirm pose didn't reach 100.
    const xAfter100 = scene.current.get('a' as never)?.pose.x ?? 0;
    act(() => clock.advance(1000));
    expect(scene.current.get('a' as never)?.pose.x).toBeCloseTo(xAfter100, 4);
  });
});

describe('d3Bind transition — selection.interrupt() namespace', () => {
  it('cancels custom tweens too, not just the pose tween', () => {
    const { scene, animator, clock } = setupSceneAndAnimator();
    act(() => {
      d3Bind(scene.current, [{ id: 'a', x: 0 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data(() => ({ color: '#000' }))
        .join();
    });
    const apply = vi.fn();
    act(() => {
      const sel = d3Bind(scene.current, [{ id: 'a', x: 100 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data(() => ({ color: '#fff' }))
        .join();
      sel.transition('move')
        .duration(1000)
        .ease(linear)
        .tween({ name: 'fade', from: () => 0, to: () => 1, apply })
        .end();
      act(() => clock.advance(100));
      sel.interrupt('move');
    });
    const callsAtInterrupt = apply.mock.calls.length;
    act(() => clock.advance(1000));
    expect(apply.mock.calls.length).toBe(callsAtInterrupt);
  });
});

describe('d3Bind transition — custom .tween()', () => {
  it('runs a custom factory interpolator and routes value to apply', async () => {
    const { scene, animator, clock } = setupSceneAndAnimator();
    act(() => {
      d3Bind(scene.current, [{ id: 'a', x: 0 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data(() => ({ color: '#000' }))
        .join();
    });
    const interpolate = vi.fn(
      (from: string, to: string) => (t: number) =>
        t < 0.5 ? from : to,
    );
    const apply = vi.fn();
    let endPromise!: Promise<void>;
    act(() => {
      const sel = d3Bind(scene.current, [{ id: 'a', x: 0 }] as Datum[], {
        key: (d) => d.id,
        animator: animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .data(() => ({ color: '#fff' }))
        .join();
      endPromise = sel
        .transition()
        .duration(1000)
        .ease(linear)
        .tween({
          name: 'fade',
          from: () => '#000',
          to: () => '#fff',
          interpolate,
          apply,
        })
        .end();
    });
    // Factory called exactly once (built at tween start).
    expect(interpolate).toHaveBeenCalledTimes(1);
    expect(interpolate).toHaveBeenCalledWith('#000', '#fff');
    act(() => clock.advance(0));
    expect(apply).toHaveBeenCalled();
    act(() => clock.advance(1000));
    await endPromise;
    // Final apply with the "to" value.
    const calls = apply.mock.calls;
    expect(calls[calls.length - 1][2]).toBe('#fff');
  });
});

describe('d3Bind transition — delay', () => {
  it('per-item delay function spreads spawn times', async () => {
    const { scene, animator, clock } = setupSceneAndAnimator();
    act(() => {
      d3Bind(
        scene.current,
        [
          { id: 'a', x: 0 },
          { id: 'b', x: 0 },
        ] as Datum[],
        { key: (d) => d.id, animator: animator.current as Animator },
      )
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join();
    });
    let endPromise!: Promise<void>;
    act(() => {
      endPromise = d3Bind(
        scene.current,
        [
          { id: 'a', x: 100 },
          { id: 'b', x: 100 },
        ] as Datum[],
        { key: (d) => d.id, animator: animator.current as Animator },
      )
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .join()
        .transition()
        .duration(100)
        .ease(linear)
        .delay((_d, i) => i * 1000)
        .end();
    });
    // Node a starts immediately; node b delayed 1000ms.
    act(() => clock.advance(100));
    expect(scene.current.get('a' as never)?.pose.x).toBeCloseTo(100, 4);
    expect(scene.current.get('b' as never)?.pose.x).toBeCloseTo(0, 4);
    // Wait for b's delay timer (setTimeout — handled by test environment).
    await new Promise((r) => setTimeout(r, 1100));
    act(() => clock.advance(100));
    // After delay + duration, b should also be at 100.
    expect(scene.current.get('b' as never)?.pose.x).toBeCloseTo(100, 4);
    await endPromise;
  });
});

type Setup = ReturnType<typeof setupSceneAndAnimator>;
const bind = ({ scene, animator }: Setup, data: Datum[]) =>
  d3Bind(scene.current, data, { key: (d) => d.id, animator: animator.current as Animator })
    .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
    .join();
const seed = (s: Setup, data: Datum[]) => act(() => void bind(s, data));
const x = ({ scene }: Setup, id: string) => scene.current.get(id as never)?.pose.x;
const at = (x: number) => () => ({ x, y: 0, width: 10, height: 10 });

describe('d3Bind transition — chained .transition()', () => {
  it('starts when the previous one ends and inherits its duration and ease', async () => {
    const s = setupSceneAndAnimator();
    seed(s, [{ id: 'a', x: 0 }]);
    let endPromise!: Promise<void>;
    act(() => {
      endPromise = bind(s, [{ id: 'a', x: 100 }])
        .transition()
        .duration(1000)
        .ease(linear)
        .transition()
        .pose(at(200))
        .end();
    });
    act(() => s.clock.advance(0));
    expect(x(s, 'a')).toBeCloseTo(0, 6);
    act(() => s.clock.advance(500));
    expect(x(s, 'a')).toBeCloseTo(50, 4);
    act(() => s.clock.advance(500));
    expect(x(s, 'a')).toBeCloseTo(100, 4);
    act(() => s.clock.advance(500));
    expect(x(s, 'a')).toBeCloseTo(150, 4);
    act(() => s.clock.advance(500));
    expect(x(s, 'a')).toBeCloseTo(200, 6);
    await endPromise;
  });

  it('lets the chained transition override duration and ease', () => {
    const s = setupSceneAndAnimator();
    seed(s, [{ id: 'a', x: 0 }]);
    const easeQuad = vi.fn((t: number) => t * t);
    act(() => {
      bind(s, [{ id: 'a', x: 100 }])
        .transition()
        .duration(1000)
        .ease(linear)
        .transition()
        .duration(200)
        .ease(easeQuad)
        .pose(at(200))
        .end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(1000));
    expect(x(s, 'a')).toBeCloseTo(100, 4);
    act(() => s.clock.advance(100));
    expect(x(s, 'a')).toBeCloseTo(125, 4);
    expect(easeQuad).toHaveBeenCalled();
    act(() => s.clock.advance(100));
    expect(x(s, 'a')).toBeCloseTo(200, 6);
  });

  it('runs a chained transition without its own .end() once the chain starts', () => {
    const s = setupSceneAndAnimator();
    seed(s, [{ id: 'a', x: 0 }]);
    const apply = vi.fn();
    act(() => {
      const first = bind(s, [{ id: 'a', x: 100 }]).transition().duration(100).ease(linear);
      first.transition().tween({ name: 'fade', from: () => 1, to: () => 0, apply });
      first.end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(100));
    act(() => s.clock.advance(100));
    expect(apply).toHaveBeenLastCalledWith({ id: 'a', x: 100 }, 'a', 0);
  });

  it('sequences per element, so a staggered chain stays staggered', async () => {
    const s = setupSceneAndAnimator();
    seed(s, [
      { id: 'a', x: 0 },
      { id: 'b', x: 0 },
    ]);
    const onEnd = vi.fn();
    let endPromise!: Promise<void>;
    act(() => {
      endPromise = bind(s, [
        { id: 'a', x: 100 },
        { id: 'b', x: 100 },
      ])
        .transition()
        .duration(100)
        .ease(linear)
        .delay((_d, i) => i * 1000)
        .transition()
        .pose(at(300))
        .on('end', onEnd)
        .end();
    });
    act(() => s.clock.advance(100));
    act(() => s.clock.advance(100));
    // a's second stage is done while b is still waiting out its delay.
    expect(x(s, 'a')).toBeCloseTo(300, 4);
    expect(x(s, 'b')).toBeCloseTo(0, 4);
    expect(onEnd).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 1100));
    act(() => s.clock.advance(100));
    act(() => s.clock.advance(100));
    expect(x(s, 'b')).toBeCloseTo(300, 4);
    await endPromise;
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('fires start on the chained transition when it begins, not when the chain does', () => {
    const s = setupSceneAndAnimator();
    seed(s, [{ id: 'a', x: 0 }]);
    const onStart = vi.fn();
    act(() => {
      bind(s, [{ id: 'a', x: 100 }])
        .transition()
        .duration(100)
        .transition()
        .pose(at(200))
        .on('start', onStart)
        .end();
    });
    expect(onStart).not.toHaveBeenCalled();
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(100));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('interrupting a transition cancels the ones chained after it', async () => {
    const s = setupSceneAndAnimator();
    seed(s, [{ id: 'a', x: 0 }]);
    const onEnd = vi.fn();
    const onInterrupt = vi.fn();
    let first!: ReturnType<ReturnType<ReturnType<typeof d3Bind>['join']>['transition']>;
    let secondEnd!: Promise<void>;
    act(() => {
      first = bind(s, [{ id: 'a', x: 100 }]).transition().duration(1000).ease(linear);
      secondEnd = first
        .transition()
        .pose(at(200))
        .on('end', onEnd)
        .on('interrupt', onInterrupt)
        .end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(500));
    act(() => first.interrupt());
    act(() => s.clock.advance(2000));
    expect(x(s, 'a')).toBeCloseTo(50, 4);
    await secondEnd;
    expect(onEnd).not.toHaveBeenCalled();
    expect(onInterrupt).toHaveBeenCalledTimes(1);
  });

  it('a transition-level .pose() retargets the first transition too', () => {
    const s = setupSceneAndAnimator();
    seed(s, [{ id: 'a', x: 0 }]);
    act(() => {
      bind(s, [{ id: 'a', x: 100 }]).transition().duration(100).ease(linear).pose(at(40)).end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(100));
    expect(x(s, 'a')).toBeCloseTo(40, 6);
  });
});

describe('d3Bind transition — node removed mid-flight', () => {
  it('stops tweening an updating node removed from the scene, and still ends', async () => {
    const s = setupSceneAndAnimator();
    seed(s, [{ id: 'a', x: 0 }, { id: 'b', x: 0 }]);
    const apply = vi.fn();
    const onEnd = vi.fn();
    let ended!: Promise<void>;
    act(() => {
      ended = bind(s, [{ id: 'a', x: 100 }, { id: 'b', x: 100 }])
        .transition()
        .duration(1000)
        .ease(linear)
        .tween({ name: 'n', from: () => 0, to: () => 1, apply })
        .on('end', onEnd)
        .end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(300));
    act(() => s.scene.current.remove('a' as never));
    apply.mockClear();
    expect(() => act(() => s.clock.advance(300))).not.toThrow();
    expect(apply.mock.calls.map(([, id]) => id)).not.toContain('a');
    act(() => s.clock.advance(1000));
    await ended;
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(s.scene.current.get('a' as never)).toBeUndefined();
    expect(x(s, 'b')).toBeCloseTo(100, 6);
  });

  it('leaves alone a same-id node removed and re-added between two frames', async () => {
    const s = setupSceneAndAnimator();
    seed(s, [{ id: 'a', x: 0 }]);
    const apply = vi.fn();
    const onEnd = vi.fn();
    let ended!: Promise<void>;
    act(() => {
      ended = bind(s, [{ id: 'a', x: 100 }])
        .transition()
        .duration(1000)
        .ease(linear)
        .tween({ name: 'n', from: () => 0, to: () => 1, apply })
        .on('end', onEnd)
        .end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(300));
    act(() => {
      s.scene.current.remove('a' as never);
      s.scene.current.add({
        id: 'a' as never,
        kind: 'leaf',
        layer: 'graph',
        pose: { x: 7, y: 0, width: 10, height: 10 },
        data: {},
      });
    });
    apply.mockClear();
    act(() => s.clock.advance(300));
    expect(x(s, 'a')).toBe(7);
    expect(apply).not.toHaveBeenCalled();
    act(() => s.clock.advance(1000));
    await ended;
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(x(s, 'a')).toBe(7);
  });

  it('stops tweening an entering node that an undo removed', () => {
    const s = setupSceneAndAnimator();
    act(() => {
      d3Bind(s.scene.current, [{ id: 'a', x: 50 }] as Datum[], {
        key: (d) => d.id,
        animator: s.animator.current as Animator,
      })
        .pose((d) => ({ x: d.x, y: 0, width: 10, height: 10 }))
        .enterFrom(() => ({ x: 0, y: 0, width: 0, height: 0 }))
        .join()
        .transition()
        .duration(1000)
        .ease(linear)
        .end();
    });
    act(() => s.clock.advance(0));
    act(() => s.clock.advance(300));
    act(() => {
      for (let n = 0; n < 10 && s.scene.current.get('a' as never); n++) s.scene.current.undo();
    });
    expect(s.scene.current.get('a' as never)).toBeUndefined();
    expect(() => act(() => s.clock.advance(300))).not.toThrow();
  });
});
