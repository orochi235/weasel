import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createClock } from '@weasel-js/clock';
import { useSimulation } from './useSimulation';
import type { SimulationNode } from './types';

/** A simulation on a clock synced by hand, ten clock ms to a step. */
function setup(rate = 1) {
  const handle = createClock({ rate, seekable: false, step: 10 });
  const requestFrame = vi.fn(() => 1);
  const onTick = vi.fn();
  const onEnd = vi.fn();
  const n: SimulationNode = { x: 0, y: 0, vx: 10, vy: 0 };
  const { result } = renderHook(() =>
    useSimulation({ nodes: [n], clock: handle, onTick, onEnd, requestFrame, cancelFrame: () => {} }),
  );
  let wall = 0;
  act(() => { handle.clock.sync(wall); });
  return {
    sim: result.current, handle, n, onTick, onEnd, requestFrame,
    step: (ms: number) => act(() => { wall += ms; handle.clock.sync(wall); }),
  };
}

describe('useSimulation on a clock', () => {
  it('steps once per step of clock time, and runs no frame loop of its own', () => {
    const { step, onTick, requestFrame } = setup();
    step(35);
    expect(onTick).toHaveBeenCalledTimes(3);
    step(5);
    expect(onTick).toHaveBeenCalledTimes(4);
    expect(requestFrame).not.toHaveBeenCalled();
  });

  it('steps at the clock rate', () => {
    const { step, onTick } = setup(2);
    step(50);
    expect(onTick).toHaveBeenCalledTimes(10);
  });

  it('holds still while the clock is paused', () => {
    const { handle, step, n, onTick } = setup();
    step(20);
    const x = n.x;
    act(() => { handle.clock.rate = 0; });
    step(1000);
    expect(onTick).toHaveBeenCalledTimes(2);
    expect(n.x).toBe(x);
  });

  it('steps nothing for time the clock goes back, and carries on from where it stands', () => {
    const { handle, step, n, onTick } = setup();
    step(100);
    const x = n.x;
    act(() => { handle.reset(); });
    step(0);
    expect(n.x).toBe(x);
    expect(onTick).toHaveBeenCalledTimes(10);
    step(20);
    expect(onTick).toHaveBeenCalledTimes(12);
  });

  it('owes no steps for time spent stopped', () => {
    const { sim, step, onTick } = setup();
    step(20);
    act(() => { sim.stop(); });
    step(500);
    expect(onTick).toHaveBeenCalledTimes(2);
    act(() => { sim.restart(); });
    step(10);
    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('stops stepping once settled, and ends once', () => {
    const { sim, step, onEnd } = setup();
    for (let i = 0; i < 100 && !sim.isSettled(); i++) step(100);
    expect(onEnd).toHaveBeenCalledTimes(1);
    const alpha = sim.alpha();
    step(1000);
    expect(sim.alpha()).toBe(alpha);
  });
});

describe('useSimulation switching clocks', () => {
  function mount() {
    const a = createClock({ rate: 1, seekable: false, step: 10 });
    const b = createClock({ rate: 1, seekable: false, step: 10 });
    const onTick = vi.fn();
    const n: SimulationNode = { x: 0, y: 0, vx: 10, vy: 0 };
    const { result, rerender } = renderHook(
      ({ clock }) => useSimulation({ nodes: [n], clock, onTick, requestFrame: () => 1, cancelFrame: () => {} }),
      { initialProps: { clock: a } },
    );
    act(() => { a.clock.sync(0); b.clock.sync(0); });
    return { sim: result.current, onTick, b, toB: () => rerender({ clock: b }) };
  }

  it('leaves a stopped simulation stopped', () => {
    const { sim, onTick, b, toB } = mount();
    act(() => { sim.stop(); });
    toB();
    act(() => { b.clock.sync(100); });
    expect(onTick).not.toHaveBeenCalled();
  });

  it('carries a running simulation over to the new clock', () => {
    const { onTick, b, toB } = mount();
    toB();
    act(() => { b.clock.sync(30); });
    expect(onTick).toHaveBeenCalledTimes(3);
  });
});
