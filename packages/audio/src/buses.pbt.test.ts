/**
 * The bus graph's gain, mute, and solo against a model: after any sequence, each fader's last target is its gain
 * when the bus is audible (unmuted, and soloed if any bus is) and 0 otherwise; the bus whose gain was set is written
 * as asked; another bus heard again resumes its own ramp to the same end; and a bus whose target did not change is
 * not written, which would cancel a ramp in flight.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createBusGraph, type BusGraph } from './buses';
import { createFakeAudioContext, type FakeParam } from './testing/fakeAudioContext';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 200;
const NAMES = ['sfx', 'music', 'voice'];

interface Bus { gain: number; muted: boolean; soloed: boolean; target: number; rampEnd: number }
type Model = Map<string, Bus>;
interface Real { ctx: ReturnType<typeof createFakeAudioContext>; graph: BusGraph }

const seen = tally();
const fader = (r: Real, name: string): FakeParam => (r.graph.node(name) as never as { gain: FakeParam }).gain;

/** Do `act`, then check every fader's writes against the model's targets. `set` names the bus whose gain was set. */
function apply(m: Model, r: Real, act: () => void, set?: { name: string; ms?: number }): void {
  const before = new Map(NAMES.map((n) => {
    const p = fader(r, n);
    return [n, { holds: p.holds.length, ramps: p.ramps.length, cancels: p.cancels.length }];
  }));
  act();
  const soloing = [...m.values()].some((b) => b.soloed);
  for (const name of NAMES) {
    const b = m.get(name)!;
    const audible = !b.muted && (!soloing || b.soloed);
    const target = audible ? b.gain : 0;
    const p = fader(r, name);
    const was = before.get(name)!;
    const h = r.graph.bus(name);
    expect([h.gain(), h.muted(), h.soloed(), h.audible()]).toEqual([b.gain, b.muted, b.soloed, audible]);
    const now = r.ctx.currentTime;
    if (set?.name === name && set.ms) {
      b.rampEnd = now + set.ms / 1000;
      expect(p.ramps.slice(was.ramps)).toEqual([{ value: target, at: b.rampEnd }]);
      seen.count('ramped');
    } else if (set?.name === name) {
      b.rampEnd = 0;
      expect(p.ramps.length).toBe(was.ramps);
      expect(p.holds.slice(was.holds).map((x) => x.value)).toEqual([target]);
      seen.count('stepped');
    } else if (target !== b.target && audible && b.rampEnd > now) {
      expect(p.ramps.slice(was.ramps)).toEqual([{ value: target, at: expect.closeTo(b.rampEnd, 9) }]);
      seen.count('resumed');
    } else if (target !== b.target) {
      expect(p.ramps.length).toBe(was.ramps);
      expect(p.holds.slice(was.holds).map((x) => x.value)).toEqual([target]);
      seen.count('stepped');
    } else {
      expect([p.holds.length, p.ramps.length, p.cancels.length]).toEqual([was.holds, was.ramps, was.cancels]);
      seen.count('left alone');
    }
    b.target = target;
  }
}

class SetGain implements fc.Command<Model, Real> {
  constructor(readonly name: string, readonly value: number, readonly ramp: number | undefined) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const ramps = this.ramp !== undefined && this.ramp > 0;
    apply(m, r, () => {
      r.graph.bus(this.name).setGain(this.value, this.ramp);
      m.get(this.name)!.gain = this.value;
    }, { name: this.name, ms: ramps ? this.ramp : undefined });
  }
  toString = () => `setGain(${this.name}, ${this.value}, ${this.ramp})`;
}

class Mute implements fc.Command<Model, Real> {
  constructor(readonly name: string, readonly on: boolean) {}
  check = () => true;
  run(m: Model, r: Real): void {
    apply(m, r, () => { r.graph.bus(this.name).mute(this.on); m.get(this.name)!.muted = this.on; });
  }
  toString = () => `mute(${this.name}, ${this.on})`;
}

class Solo implements fc.Command<Model, Real> {
  constructor(readonly name: string, readonly on: boolean) {}
  check = () => true;
  run(m: Model, r: Real): void {
    apply(m, r, () => { r.graph.bus(this.name).solo(this.on); m.get(this.name)!.soloed = this.on; });
  }
  toString = () => `solo(${this.name}, ${this.on})`;
}

class Advance implements fc.Command<Model, Real> {
  constructor(readonly ms: number) {}
  check = () => true;
  run(_m: Model, r: Real): void { r.ctx._advance(this.ms); }
  toString = () => `advance(${this.ms})`;
}

const name = fc.constantFrom(...NAMES);
const level = fc.oneof(fc.constantFrom(0, 0.5, 1), fc.double({ min: 0, max: 2, noNaN: true }));
const commands = fc.commands([
  ...[1, 2].map(() => fc.tuple(name, level, fc.option(fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 500 })), { nil: undefined })).map(([n, v, ms]) => new SetGain(n, v, ms))),
  fc.tuple(name, fc.boolean()).map(([n, on]) => new Mute(n, on)),
  fc.tuple(name, fc.boolean()).map(([n, on]) => new Solo(n, on)),
  fc.integer({ min: 0, max: 1000 }).map((ms) => new Advance(ms)),
], { maxCommands: 40, size: '+1' });

describe('createBusGraph', () => {
  it('writes each fader its gain when audible and 0 otherwise, ramping the bus asked to, resuming one heard again, and leaving the rest', () => {
    fc.assert(fc.property(commands, (cmds) => {
      const ctx = createFakeAudioContext();
      const graph = createBusGraph(ctx as never, NAMES);
      const model: Model = new Map(NAMES.map((n) => [n, { gain: 1, muted: false, soloed: false, target: 1, rampEnd: 0 }]));
      fc.modelRun(() => ({ model, real: { ctx, graph } }), cmds);
    }), runs(RUNS));
    for (const what of ['ramped', 'stepped', 'left alone']) seen.atLeast(what, RUNS);
    seen.atLeast('resumed', RUNS / 20);
  }, timeoutFor(RUNS, 10));

  it('refuses a gain or ramp that is not finite and keeps what it had', () => {
    fc.assert(fc.property(fc.constantFrom(Number.NaN, Infinity, -Infinity), fc.boolean(), (bad, asRamp) => {
      const graph = createBusGraph(createFakeAudioContext() as never, NAMES);
      graph.bus('sfx').setGain(0.5);
      expect(() => graph.bus('sfx').setGain(asRamp ? 0.25 : bad, asRamp ? bad : undefined)).toThrow(RangeError);
      expect(graph.bus('sfx').gain()).toBe(0.5);
    }), runs(RUNS));
  });
});
