import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSimulation } from './useSimulation';
import {
  DEFAULT_ALPHA_DECAY,
  DEFAULT_ALPHA_MIN,
  type SimulationForce,
  type SimulationNode,
} from './types';

/** Minimal manual rAF driver. Mirrors useAnimator.test.tsx. */
function makeClock() {
  let next = 1;
  const callbacks = new Map<number, (t: number) => void>();
  let now = 0;
  return {
    requestFrame: (cb: (t: number) => void): number => {
      const h = next++;
      callbacks.set(h, cb);
      return h;
    },
    cancelFrame: (h: number): void => {
      callbacks.delete(h);
    },
    /** Fire every queued frame once. */
    frame() {
      now += 16;
      const due = Array.from(callbacks.entries());
      callbacks.clear();
      for (const [, cb] of due) cb(now);
    },
    /** Run `n` frames in a row. */
    frames(n: number) {
      for (let i = 0; i < n; i++) this.frame();
    },
    pendingCount() {
      return callbacks.size;
    },
  };
}

interface TestNode extends SimulationNode {
  id: string;
}

const node = (id: string, x = 0, y = 0): TestNode => ({ id, x, y });

describe('useSimulation alpha decay', () => {
  it('starts at alpha = 1 by default', () => {
    const clock = makeClock();
    const { result } = renderHook(() =>
      useSimulation({ nodes: [node('a')], requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    expect(result.current.alpha()).toBe(1);
  });

  it('decays toward alphaTarget = 0 each tick', () => {
    const clock = makeClock();
    const { result } = renderHook(() =>
      useSimulation({ nodes: [node('a')], requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    const a0 = result.current.alpha();
    act(() => clock.frame());
    const a1 = result.current.alpha();
    expect(a1).toBeLessThan(a0);
    // exact formula: a += (target - a) * decay
    expect(a1).toBeCloseTo(a0 + (0 - a0) * DEFAULT_ALPHA_DECAY, 6);
  });

  it('settles in ~300 frames at default decay', () => {
    const clock = makeClock();
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useSimulation({
        nodes: [node('a')],
        onEnd,
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    // Generously: 500 frames covers the worst case for default decay.
    for (let i = 0; i < 500; i++) {
      if (result.current.isSettled()) break;
      act(() => clock.frame());
    }
    expect(result.current.isSettled()).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(result.current.alpha()).toBeLessThan(DEFAULT_ALPHA_MIN);
  });

  it('alphaTarget > 0 keeps the sim warm (never settles)', () => {
    const clock = makeClock();
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useSimulation({
        nodes: [node('a')],
        alphaTarget: 0.3,
        onEnd,
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    act(() => clock.frames(500));
    expect(result.current.alpha()).toBeGreaterThan(0.2);
    expect(onEnd).not.toHaveBeenCalled();
    expect(result.current.isSettled()).toBe(false);
  });
});

describe('useSimulation integration', () => {
  it('integrates vx into x each tick with default velocityDecay = 0.4', () => {
    const clock = makeClock();
    const n: TestNode = { id: 'a', x: 0, y: 0, vx: 10, vy: 0 };
    renderHook(() =>
      useSimulation({ nodes: [n], requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    // friction = 1 - 0.4 = 0.6. After one tick: vx = 10 * 0.6 = 6, x += 6.
    act(() => clock.frame());
    expect(n.vx).toBeCloseTo(6, 6);
    expect(n.x).toBeCloseTo(6, 6);
    act(() => clock.frame());
    // After two ticks: vx = 6 * 0.6 = 3.6, x = 6 + 3.6 = 9.6
    expect(n.vx).toBeCloseTo(3.6, 6);
    expect(n.x).toBeCloseTo(9.6, 6);
  });

  it('respects custom velocityDecay', () => {
    const clock = makeClock();
    const n: TestNode = { id: 'a', x: 0, y: 0, vx: 10, vy: 0 };
    renderHook(() =>
      useSimulation({
        nodes: [n],
        velocityDecay: 0,    // no friction
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    act(() => clock.frame());
    expect(n.vx).toBeCloseTo(10, 6);
    expect(n.x).toBeCloseTo(10, 6);
  });

  it('fx pins x and zeroes vx; clearing fx releases', () => {
    const clock = makeClock();
    const n: TestNode = { id: 'a', x: 0, y: 0, vx: 5, vy: 0, fx: 100 };
    const { result } = renderHook(() =>
      useSimulation({ nodes: [n], requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    act(() => clock.frame());
    expect(n.x).toBe(100);
    expect(n.vx).toBe(0);

    // Clear fx → integration resumes from current state
    n.fx = null;
    n.vx = 5;
    act(() => result.current.alpha(1).restart());
    act(() => clock.frame());
    expect(n.vx).toBeCloseTo(3, 6);   // 5 * 0.6
    expect(n.x).toBeCloseTo(103, 6);
  });

  it('applies fy independently of fx (mixed pinning)', () => {
    const clock = makeClock();
    const n: TestNode = { id: 'a', x: 0, y: 0, vx: 5, vy: 7, fy: 50 };
    renderHook(() =>
      useSimulation({ nodes: [n], requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    act(() => clock.frame());
    expect(n.y).toBe(50);
    expect(n.vy).toBe(0);
    expect(n.x).toBeCloseTo(3, 6);    // 5 * 0.6
  });
});

describe('useSimulation force protocol', () => {
  it('calls initialize on mount with the nodes array', () => {
    const clock = makeClock();
    const initialize = vi.fn();
    const force: SimulationForce<TestNode> = Object.assign((_alpha: number) => {}, { initialize });
    renderHook(() =>
      useSimulation({
        nodes: [node('a'), node('b')],
        forces: [force],
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(initialize.mock.calls[0][0]).toHaveLength(2);
  });

  it('writes node.index during initialize phase', () => {
    const clock = makeClock();
    const nodes = [node('a'), node('b'), node('c')];
    renderHook(() =>
      useSimulation({ nodes, requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    expect(nodes[0].index).toBe(0);
    expect(nodes[1].index).toBe(1);
    expect(nodes[2].index).toBe(2);
  });

  it('calls forces with current alpha each tick', () => {
    const clock = makeClock();
    const alphas: number[] = [];
    const force: SimulationForce<TestNode> = (alpha) => {
      alphas.push(alpha);
    };
    renderHook(() =>
      useSimulation({
        nodes: [node('a')],
        forces: [force],
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    act(() => clock.frames(3));
    expect(alphas).toHaveLength(3);
    expect(alphas[0]).toBeLessThan(1);
    expect(alphas[1]).toBeLessThan(alphas[0]);
    expect(alphas[2]).toBeLessThan(alphas[1]);
  });

  it('clamps non-finite positions/velocities so renderer geometry never goes infinite', () => {
    // A pathological force can drive vx to Infinity. Without a guard, position
    // goes Infinity → ellipsePath emits an unbounded shape → the path
    // tessellator hangs trying to flatten a degenerate curve. Guard resets
    // non-finite state to 0 so the sim self-recovers.
    const clock = makeClock();
    const n: TestNode = { id: 'a', x: 0, y: 0 };
    let pumped = false;
    const overflower: SimulationForce<TestNode> = () => {
      if (!pumped) {
        pumped = true;
        n.vx = Infinity;
      }
    };
    renderHook(() =>
      useSimulation({
        nodes: [n],
        forces: [overflower],
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    act(() => clock.frame());
    expect(Number.isFinite(n.x)).toBe(true);
    expect(Number.isFinite(n.vx)).toBe(true);
  });

  it('initializes vx/vy to 0 so forces doing `n.vx += f` do not produce NaN', () => {
    // d3-force forces (e.g. forceManyBody) assume vx/vy are numbers. Without
    // explicit init, `undefined + number === NaN` propagates through the sim.
    const clock = makeClock();
    const n: TestNode = { id: 'a', x: 0, y: 0 };
    const dForceLike: SimulationForce<TestNode> = () => {
      n.vx = (n.vx as number) + 1;
      n.vy = (n.vy as number) + 1;
    };
    renderHook(() =>
      useSimulation({
        nodes: [n],
        forces: [dForceLike],
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    expect(n.vx).toBe(0);
    expect(n.vy).toBe(0);
    act(() => clock.frame());
    expect(Number.isFinite(n.x)).toBe(true);
    expect(Number.isFinite(n.vx)).toBe(true);
  });

  it('forces can mutate vx/vy to drive nodes', () => {
    const clock = makeClock();
    const n: TestNode = { id: 'a', x: 0, y: 0 };
    const force: SimulationForce<TestNode> = () => {
      n.vx = (n.vx ?? 0) + 1;
    };
    renderHook(() =>
      useSimulation({
        nodes: [n],
        forces: [force],
        velocityDecay: 0,
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    act(() => clock.frame());
    expect(n.vx).toBeCloseTo(1, 6);
    expect(n.x).toBeCloseTo(1, 6);
    act(() => clock.frame());
    expect(n.vx).toBeCloseTo(2, 6);
    expect(n.x).toBeCloseTo(3, 6);     // 1 + 2
  });

  it('setForces initializes new forces only', () => {
    const clock = makeClock();
    const initA = vi.fn();
    const initB = vi.fn();
    const forceA: SimulationForce<TestNode> = Object.assign((_a: number) => {}, { initialize: initA });
    const forceB: SimulationForce<TestNode> = Object.assign((_a: number) => {}, { initialize: initB });
    const { result } = renderHook(() =>
      useSimulation({
        nodes: [node('a')],
        forces: [forceA],
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    expect(initA).toHaveBeenCalledTimes(1);
    expect(initB).not.toHaveBeenCalled();

    act(() => result.current.setForces([forceA, forceB]));
    expect(initA).toHaveBeenCalledTimes(1);  // unchanged
    expect(initB).toHaveBeenCalledTimes(1);  // newly added
  });

  it('setNodes re-initializes all forces and re-indexes', () => {
    const clock = makeClock();
    const initialize = vi.fn();
    const force: SimulationForce<TestNode> = Object.assign((_a: number) => {}, { initialize });
    const { result } = renderHook(() =>
      useSimulation({
        nodes: [node('a')],
        forces: [force],
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    expect(initialize).toHaveBeenCalledTimes(1);

    const newNodes = [node('x'), node('y')];
    act(() => result.current.setNodes(newNodes));
    expect(initialize).toHaveBeenCalledTimes(2);
    expect(newNodes[0].index).toBe(0);
    expect(newNodes[1].index).toBe(1);
  });
});

describe('useSimulation lifecycle', () => {
  it('onTick fires after each integration step with nodes', () => {
    const clock = makeClock();
    const n = node('a');
    const onTick = vi.fn();
    renderHook(() =>
      useSimulation({
        nodes: [n],
        onTick,
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    act(() => clock.frame());
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(onTick.mock.calls[0][0]).toEqual([n]);
  });

  it('stop() cancels RAF without changing alpha', () => {
    const clock = makeClock();
    const { result } = renderHook(() =>
      useSimulation({ nodes: [node('a')], requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    expect(clock.pendingCount()).toBe(1);
    const a = result.current.alpha();
    act(() => result.current.stop());
    expect(clock.pendingCount()).toBe(0);
    expect(result.current.alpha()).toBe(a);
  });

  it('restart() after stop resumes ticking', () => {
    const clock = makeClock();
    const onTick = vi.fn();
    const { result } = renderHook(() =>
      useSimulation({
        nodes: [node('a')],
        onTick,
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    act(() => result.current.stop());
    onTick.mockClear();
    act(() => result.current.restart());
    act(() => clock.frame());
    expect(onTick).toHaveBeenCalledTimes(1);
  });

  it('restart() resets alpha to 1 if currently below alphaMin', () => {
    const clock = makeClock();
    const { result } = renderHook(() =>
      useSimulation({ nodes: [node('a')], requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    act(() => result.current.alpha(0.0001).stop());
    expect(result.current.alpha()).toBeLessThan(DEFAULT_ALPHA_MIN);
    act(() => result.current.restart());
    expect(result.current.alpha()).toBe(1);
  });

  it('restart() does NOT reset alpha if currently above alphaMin', () => {
    const clock = makeClock();
    const { result } = renderHook(() =>
      useSimulation({ nodes: [node('a')], requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    act(() => result.current.alpha(0.5).stop());
    act(() => result.current.restart());
    expect(result.current.alpha()).toBe(0.5);
  });

  it('tick(n) runs n synchronous steps without firing onTick / onEnd', () => {
    const clock = makeClock();
    const onTick = vi.fn();
    const onEnd = vi.fn();
    const n: TestNode = { id: 'a', x: 0, y: 0, vx: 10, vy: 0 };
    const { result } = renderHook(() =>
      useSimulation({
        nodes: [n],
        onTick,
        onEnd,
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    act(() => result.current.stop());
    onTick.mockClear();
    act(() => result.current.tick(5));
    expect(onTick).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    // 5 ticks of friction-only integration: vx *= 0.6 each tick
    expect(n.vx).toBeCloseTo(10 * 0.6 ** 5, 4);
  });

  it('onEnd fires exactly once on natural settle', () => {
    const clock = makeClock();
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useSimulation({
        nodes: [node('a')],
        onEnd,
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    for (let i = 0; i < 500; i++) {
      if (result.current.isSettled()) break;
      act(() => clock.frame());
    }
    expect(onEnd).toHaveBeenCalledTimes(1);
    // No more frames pending after settle.
    expect(clock.pendingCount()).toBe(0);
  });

  it('onEnd fires again on re-settle after restart', () => {
    const clock = makeClock();
    const onEnd = vi.fn();
    const { result } = renderHook(() =>
      useSimulation({
        nodes: [node('a')],
        onEnd,
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    for (let i = 0; i < 500; i++) {
      if (result.current.isSettled()) break;
      act(() => clock.frame());
    }
    expect(onEnd).toHaveBeenCalledTimes(1);

    act(() => result.current.alpha(1).restart());
    for (let i = 0; i < 500; i++) {
      if (result.current.isSettled()) break;
      act(() => clock.frame());
    }
    expect(onEnd).toHaveBeenCalledTimes(2);
  });

  it('unmount cancels the RAF loop cleanly', () => {
    const clock = makeClock();
    const onTick = vi.fn();
    const { unmount } = renderHook(() =>
      useSimulation({
        nodes: [node('a')],
        onTick,
        requestFrame: clock.requestFrame,
        cancelFrame: clock.cancelFrame,
      }),
    );
    expect(clock.pendingCount()).toBe(1);
    unmount();
    expect(clock.pendingCount()).toBe(0);
    onTick.mockClear();
    act(() => clock.frame());     // no pending callbacks, but ensure no leak
    expect(onTick).not.toHaveBeenCalled();
  });
});

describe('useSimulation handle methods', () => {
  it('alphaTarget getter / setter', () => {
    const clock = makeClock();
    const { result } = renderHook(() =>
      useSimulation({ nodes: [node('a')], requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    expect(result.current.alphaTarget()).toBe(0);
    act(() => result.current.alphaTarget(0.5));
    expect(result.current.alphaTarget()).toBe(0.5);
  });

  it('alphaDecay getter / setter', () => {
    const clock = makeClock();
    const { result } = renderHook(() =>
      useSimulation({ nodes: [node('a')], requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    expect(result.current.alphaDecay()).toBeCloseTo(DEFAULT_ALPHA_DECAY, 6);
    act(() => result.current.alphaDecay(0.1));
    expect(result.current.alphaDecay()).toBe(0.1);
  });

  it('chains setters', () => {
    const clock = makeClock();
    const { result } = renderHook(() =>
      useSimulation({ nodes: [node('a')], requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }),
    );
    act(() => {
      result.current.alpha(0.8).alphaTarget(0.3).velocityDecay(0.2);
    });
    expect(result.current.alpha()).toBe(0.8);
    expect(result.current.alphaTarget()).toBe(0.3);
    expect(result.current.velocityDecay()).toBe(0.2);
  });
});
