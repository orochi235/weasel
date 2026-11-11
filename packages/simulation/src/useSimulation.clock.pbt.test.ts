/**
 * Stateful test of a simulation stepping on a clock: frames of any length, rate changes (a rate of 0 is a pause),
 * stops, and restarts, against a model that owes one step per `step` ms of clock time spent running. Rates, frame
 * lengths, and steps are dyadic, so the model's sums are exact.
 */
import { afterEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { act, cleanup, renderHook } from '@testing-library/react';
import { createClock, type ClockHandle } from '@weasel-js/clock';
import { useSimulation } from './useSimulation';
import { runs, tally, timeoutFor } from './pbt.fixture';
import type { Simulation, SimulationNode } from './types';

interface Model { elapsed: number; rate: number; slept: boolean; running: boolean; anchor: number; atAnchor: number; step: number }
interface Real { handle: ClockHandle; sim: Simulation<SimulationNode>; ticks: number; wall: number; node: SimulationNode }

const seen = tally();
const owed = (m: Model): number => m.atAnchor + (m.running ? Math.floor((m.elapsed - m.anchor) / m.step) : 0);

function check(m: Model, r: Real): void {
  expect(r.handle.clock.elapsed).toBe(m.elapsed);
  expect(r.ticks).toBe(owed(m));
  expect(Number.isFinite(r.node.x) && Number.isFinite(r.node.y)).toBe(true);
}

class Advance implements fc.Command<Model, Real> {
  constructor(readonly dt: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    r.wall += this.dt;
    act(() => { r.handle.clock.sync(r.wall); });
    // A clock that synced while paused only records the time on its next sync, rate change or not.
    if (!m.slept) m.elapsed += m.rate * this.dt;
    m.slept = m.rate === 0;
    if (m.running && m.rate > 0 && this.dt > 0) seen.count('ran');
    if (m.rate === 0 && this.dt > 0) seen.count('paused');
    check(m, r);
  }
  toString = () => `advance(${this.dt})`;
}

class Rate implements fc.Command<Model, Real> {
  constructor(readonly rate: number) {}
  check = () => true;
  run(m: Model, r: Real): void {
    act(() => { r.handle.clock.rate = this.rate; });
    m.rate = this.rate;
    check(m, r);
  }
  toString = () => `rate(${this.rate})`;
}

class Stop implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    act(() => { r.sim.stop(); });
    if (m.running) {
      m.atAnchor = owed(m);
      m.running = false;
      seen.count('stopped');
    }
    check(m, r);
  }
  toString = () => 'stop';
}

class Restart implements fc.Command<Model, Real> {
  check = () => true;
  run(m: Model, r: Real): void {
    act(() => { r.sim.restart(); });
    if (!m.running) {
      m.running = true;
      m.anchor = m.elapsed;
      seen.count('restarted');
    }
    check(m, r);
  }
  toString = () => 'restart';
}

const commands = [
  fc.integer({ min: 0, max: 80 }).map((k) => new Advance(k / 2)),
  fc.integer({ min: 0, max: 80 }).map((k) => new Advance(k / 2)),
  fc.integer({ min: 0, max: 80 }).map((k) => new Advance(k / 2)),
  fc.constantFrom(0, 0.25, 0.5, 1, 2, 4).map((v) => new Rate(v)),
  fc.constant(new Stop()),
  fc.constant(new Restart()),
];

afterEach(() => { cleanup(); });

describe('useSimulation on a clock', () => {
  it('steps once per step of clock time it runs for, however frames, rates, pauses, and stops fall', () => {
    fc.assert(fc.property(
      fc.constantFrom(1, 2.5, 8, 16, undefined),
      fc.constantFrom(0, 0.5, 1, 2),
      fc.commands(commands, { maxCommands: 30 }),
      (step, rate, cmds) => {
        const handle = createClock({ rate, seekable: false, ...(step !== undefined ? { step } : {}) });
        const node: SimulationNode = { x: 0, y: 0, vx: 1, vy: 0 };
        const real = { handle, ticks: 0, wall: 0, node } as Real;
        const { result, unmount } = renderHook(() => useSimulation({
          nodes: [node], alphaTarget: 0.5, clock: handle,
          onTick: () => { real.ticks += 1; }, requestFrame: () => 1, cancelFrame: () => {},
        }));
        real.sim = result.current;
        act(() => { handle.clock.sync(0); });
        const m: Model = { elapsed: 0, rate, slept: rate === 0, running: true, anchor: 0, atAnchor: 0, step: step ?? 1000 / 60 };
        try {
          fc.modelRun(() => ({ model: m, real }), cmds);
          if (real.ticks > 0) seen.count('stepped');
        } finally {
          unmount();
        }
      },
    ), runs(150));
    seen.atLeast('stepped', 20);
    seen.atLeast('ran', 60);
    seen.atLeast('paused', 20);
    seen.atLeast('stopped', 20);
    seen.atLeast('restarted', 15);
  }, timeoutFor(150, 20));
});
